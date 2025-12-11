'use client'

import { useCallback, useRef } from 'react'
import { useAIAssistantStore, ChatMessage } from '@/lib/stores/aiAssistantStore'
import { useBookContextStore } from '@/lib/stores/bookContextStore'

interface UseAIChatOptions {
  bookId: string
  bookTitle: string
  bookAuthor?: string
}

export function useAIChat({ bookId, bookTitle, bookAuthor }: UseAIChatOptions) {
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    isLoading,
    streamingResponse,
    error,
    addMessage,
    setLoading,
    setStreamingResponse,
    appendStreamingResponse,
    setError,
    clearChat,
    getChatHistory,
    finalizeStreamingMessage,
  } = useAIAssistantStore()

  const { getFullContext, currentPosition } = useBookContextStore()

  const sendMessage = useCallback(
    async (message: string, position?: number) => {
      if (!message.trim() || isLoading) return

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message.trim(),
        timestamp: Date.now(),
      }

      addMessage(bookId, userMessage)
      setLoading(true)
      setError(null)
      setStreamingResponse('')

      try {
        const effectivePosition = position ?? currentPosition
        // Get context ONLY up to the current reading position
        const bookContext = getFullContext(bookId, effectivePosition)

        if (!bookContext || bookContext.trim().length === 0) {
          setError('No content has been read yet. Start reading to use the AI assistant!')
          setLoading(false)
          return
        }

        const chatHistory = getChatHistory(bookId)

        const response = await fetch('/api/ai-assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            bookContext,
            bookTitle,
            bookAuthor,
            currentPosition: effectivePosition,
            chatHistory: chatHistory.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get response')
        }

        // Handle streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No response body')
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          const lines = text.split('\n').filter((line) => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                finalizeStreamingMessage(bookId)
                break
              }
              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  appendStreamingResponse(parsed.content)
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        // Finalize if not already done
        const { streamingResponse: finalResponse } = useAIAssistantStore.getState()
        if (finalResponse) {
          finalizeStreamingMessage(bookId)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, ignore
          return
        }
        console.error('AI Chat error:', err)
        if (err instanceof TypeError) {
          setError('Unable to reach the AI assistant. Check your connection and ensure the AI API key is configured.')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to get response')
        }
      } finally {
        setLoading(false)
        abortControllerRef.current = null
      }
    },
    [
      bookId,
      bookTitle,
      bookAuthor,
      isLoading,
      currentPosition,
      addMessage,
      setLoading,
      setError,
      setStreamingResponse,
      getFullContext,
      getChatHistory,
      appendStreamingResponse,
      finalizeStreamingMessage,
    ]
  )

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setLoading(false)
    }
  }, [setLoading])

  const clear = useCallback(() => {
    clearChat(bookId)
  }, [bookId, clearChat])

  return {
    isLoading,
    streamingResponse,
    error,
    chatHistory: getChatHistory(bookId),
    sendMessage,
    cancelRequest,
    clearChat: clear,
  }
}
