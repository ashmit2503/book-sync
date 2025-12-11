'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UserPreferences {
  id?: string
  user_id?: string
  font_size: number
  font_family: string
  line_spacing: number
  margins: 'narrow' | 'normal' | 'wide'
  reading_theme: 'light' | 'dark' | 'sepia' | 'system'
  scroll_mode: 'vertical' | 'horizontal'
  auto_save_interval: number
  show_reading_time: boolean
  enable_tts: boolean
  tts_speed: number
  tts_voice: string | null
  dyslexia_font: boolean
  high_contrast: boolean
}

const defaultPreferences: UserPreferences = {
  font_size: 100,
  font_family: 'default',
  line_spacing: 1.5,
  margins: 'normal',
  reading_theme: 'system',
  scroll_mode: 'vertical',
  auto_save_interval: 30,
  show_reading_time: true,
  enable_tts: false,
  tts_speed: 1.0,
  tts_voice: null,
  dyslexia_font: false,
  high_contrast: false,
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const supabaseRef = useRef(createClient())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      setIsLoading(true)
      
      // Try localStorage first for instant feedback
      const cached = localStorage.getItem('user-preferences')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setPreferences({ ...defaultPreferences, ...parsed })
        } catch (e) {
          console.error('Failed to parse cached preferences:', e)
        }
      }

      // Fetch from database
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data, error } = await supabaseRef.current
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data && !error) {
        const dbPreferences: UserPreferences = {
          id: data.id,
          user_id: data.user_id,
          font_size: data.font_size,
          font_family: data.font_family,
          line_spacing: data.line_spacing,
          margins: data.margins,
          reading_theme: data.reading_theme,
          scroll_mode: data.scroll_mode,
          auto_save_interval: data.auto_save_interval,
          show_reading_time: data.show_reading_time,
          enable_tts: data.enable_tts,
          tts_speed: data.tts_speed,
          tts_voice: data.tts_voice,
          dyslexia_font: data.dyslexia_font,
          high_contrast: data.high_contrast,
        }
        setPreferences(dbPreferences)
        localStorage.setItem('user-preferences', JSON.stringify(dbPreferences))
        
        // Sync reading theme with ThemeProvider
        if (data.reading_theme && data.reading_theme !== 'sepia') {
          localStorage.setItem('booksync-theme', data.reading_theme)
        }
      }

      setIsLoading(false)
    }

    loadPreferences()

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Save to database (debounced)
  const saveToDatabase = useCallback(
    async (newPreferences: UserPreferences) => {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) return

      setIsSaving(true)

      try {
        const { error } = await supabaseRef.current
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            font_size: newPreferences.font_size,
            font_family: newPreferences.font_family,
            line_spacing: newPreferences.line_spacing,
            margins: newPreferences.margins,
            reading_theme: newPreferences.reading_theme,
            scroll_mode: newPreferences.scroll_mode,
            auto_save_interval: newPreferences.auto_save_interval,
            show_reading_time: newPreferences.show_reading_time,
            enable_tts: newPreferences.enable_tts,
            tts_speed: newPreferences.tts_speed,
            tts_voice: newPreferences.tts_voice,
            dyslexia_font: newPreferences.dyslexia_font,
            high_contrast: newPreferences.high_contrast,
          }, {
            onConflict: 'user_id',
          })

        if (error) {
          console.error('Failed to save preferences:', error)
        }
      } catch (error) {
        console.error('Failed to save preferences:', error)
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  // Update preferences
  const updatePreferences = useCallback(
    (update: Partial<UserPreferences>) => {
      setPreferences((prev) => {
        const newPreferences = { ...prev, ...update }

        // Save to localStorage immediately
        localStorage.setItem('user-preferences', JSON.stringify(newPreferences))

        // Dispatch custom event for accessibility updates
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('accessibility-update', {
              detail: {
                dyslexia_font: newPreferences.dyslexia_font,
                high_contrast: newPreferences.high_contrast,
              },
            })
          )
        }

        // Debounced save to database
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }

        debounceTimerRef.current = setTimeout(() => {
          saveToDatabase(newPreferences)
        }, 1000)

        return newPreferences
      })
    },
    [saveToDatabase]
  )

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences)
    localStorage.setItem('user-preferences', JSON.stringify(defaultPreferences))
    saveToDatabase(defaultPreferences)
  }, [saveToDatabase])

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    isLoading,
    isSaving,
  }
}
