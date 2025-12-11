'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseReadingSessionOptions {
  bookId: string
  enabled?: boolean
}

export function useReadingSession({ bookId, enabled = true }: UseReadingSessionOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStart, setSessionStart] = useState<Date | null>(null)
  const [isActive, setIsActive] = useState(false)
  
  const supabaseRef = useRef(createClient())
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startPageRef = useRef<number>(0)
  const currentPageRef = useRef<number>(0)

  // Start a new reading session
  const startSession = useCallback(async (startPage: number = 0) => {
    if (!enabled) return

    const { data: { user } } = await supabaseRef.current.auth.getUser()
    if (!user) return

    // End any existing session first
    if (sessionId) {
      await endSession()
    }

    const now = new Date()
    const { data, error } = await supabaseRef.current
      .from('reading_sessions')
      .insert({
        user_id: user.id,
        book_id: bookId,
        started_at: now.toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to start reading session:', error)
      return
    }

    setSessionId(data.id)
    setSessionStart(now)
    setIsActive(true)
    startPageRef.current = startPage
    currentPageRef.current = startPage

    // Start periodic save
    saveIntervalRef.current = setInterval(() => {
      saveSessionProgress()
    }, 60000) // Save every minute
  }, [enabled, bookId, sessionId])

  // End the current session
  const endSession = useCallback(async () => {
    if (!sessionId || !sessionStart) return

    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current)
      saveIntervalRef.current = null
    }

    const endTime = new Date()
    const durationMinutes = Math.round(
      (endTime.getTime() - sessionStart.getTime()) / 60000
    )
    const pagesRead = Math.max(0, currentPageRef.current - startPageRef.current)

    const { error } = await supabaseRef.current
      .from('reading_sessions')
      .update({
        ended_at: endTime.toISOString(),
        duration_minutes: durationMinutes,
        pages_read: pagesRead,
      })
      .eq('id', sessionId)

    if (error) {
      console.error('Failed to end reading session:', error)
    }

    setSessionId(null)
    setSessionStart(null)
    setIsActive(false)
  }, [sessionId, sessionStart])

  // Save session progress periodically
  const saveSessionProgress = useCallback(async () => {
    if (!sessionId || !sessionStart) return

    const now = new Date()
    const durationMinutes = Math.round(
      (now.getTime() - sessionStart.getTime()) / 60000
    )
    const pagesRead = Math.max(0, currentPageRef.current - startPageRef.current)

    await supabaseRef.current
      .from('reading_sessions')
      .update({
        duration_minutes: durationMinutes,
        pages_read: pagesRead,
      })
      .eq('id', sessionId)
  }, [sessionId, sessionStart])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current)
      }
      // End session on unmount
      if (sessionId) {
        endSession()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        endSession()
      }
    }

    const handleBeforeUnload = () => {
      if (isActive) {
        // Sync save before unload
        navigator.sendBeacon?.(
          `/api/books/${bookId}/session/end`,
          JSON.stringify({ sessionId })
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isActive, bookId, sessionId, endSession])

  return {
    startSession,
    endSession,
  }
}
