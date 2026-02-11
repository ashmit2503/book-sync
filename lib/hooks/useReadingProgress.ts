'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ReadingProgress {
  currentPage: number
  totalPages: number
  percentage: number
  lastRead: string | null
  scrollPercentage?: number
  pageOffsetPercent?: number  // Offset within the current page (0-1)
  location?: string // For EPUB CFI
}

export function useReadingProgress(bookId: string) {
  const [progress, setProgress] = useState<ReadingProgress>({
    currentPage: 1,
    totalPages: 0,
    percentage: 0,
    lastRead: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')

  // Load progress from database on mount
  useEffect(() => {
    async function loadProgress() {
      setIsLoading(true)
      
      // Try localStorage first for instant feedback
      const cached = localStorage.getItem(`book-${bookId}-progress`)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setProgress(parsed)
          lastSavedRef.current = JSON.stringify(parsed)
        } catch (e) {
          console.error('Failed to parse cached progress:', e)
        }
      }

      // Fetch from database
      const { data: book } = await supabaseRef.current
        .from('books')
        .select('reading_progress')
        .eq('id', bookId)
        .single()

      if (book?.reading_progress) {
        const dbProgress = book.reading_progress as ReadingProgress
        setProgress(dbProgress)
        lastSavedRef.current = JSON.stringify(dbProgress)
        // Update localStorage to match database
        localStorage.setItem(`book-${bookId}-progress`, JSON.stringify(dbProgress))
      }

      setIsLoading(false)
    }

    loadProgress()

    // Cleanup debounce timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [bookId])

  // Save to database (debounced internally)
  const saveToDatabase = useCallback(
    (newProgress: ReadingProgress) => {
      // Skip if nothing changed (prevents infinite loops)
      const serialized = JSON.stringify(newProgress)
      if (serialized === lastSavedRef.current) {
        return
      }

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Debounce: wait 2 seconds before saving
      debounceTimerRef.current = setTimeout(async () => {
        try {
          lastSavedRef.current = serialized
          await supabaseRef.current
            .from('books')
            .update({
              reading_progress: newProgress,
            })
            .eq('id', bookId)
        } catch (error) {
          console.error('Failed to save progress:', error)
        }
      }, 2000)
    },
    [bookId]
  )

  // Use a ref to track the latest progress for saving without triggering re-renders.
  // Only update React state when the page/percentage actually changes (meaningful UI update).
  const progressRef = useRef(progress)
  progressRef.current = progress

  const updateProgress = useCallback(
    (update: Partial<ReadingProgress>) => {
      const prev = progressRef.current
      const newProgress: ReadingProgress = {
        ...prev,
        ...update,
        lastRead: new Date().toISOString(),
      }

      // Always save to localStorage and database
      localStorage.setItem(`book-${bookId}-progress`, JSON.stringify(newProgress))
      saveToDatabase(newProgress)

      // Only update React state (triggering re-render) when position actually changed.
      // This prevents re-renders from the timestamp-only updates that cause
      // epub.js layout-shift → relocated → updateProgress → re-render loops.
      const positionChanged =
        prev.currentPage !== newProgress.currentPage ||
        Math.abs(prev.percentage - newProgress.percentage) > 0.5

      if (positionChanged) {
        progressRef.current = newProgress
        setProgress(newProgress)
      } else {
        // Update ref without re-rendering
        progressRef.current = newProgress
      }
    },
    [bookId, saveToDatabase]
  )

  return {
    progress,
    updateProgress,
    isLoading,
  }
}
