'use client'

import { useCallback, useRef } from 'react'
import { useAIAssistantStore, ChatMessage, AIMode } from '@/lib/stores/aiAssistantStore'
import { useBookContextStore } from '@/lib/stores/bookContextStore'

interface UseAIChatOptions {
  bookId: string
  bookTitle: string
  bookAuthor?: string
}

export function useAIChat({ bookId, bookTitle, bookAuthor }: UseAIChatOptions) {
  const abortControllerRef = useRef<AbortController | null>(null)
  const isLoadingRef = useRef(false)

  const {
    isLoading,
    streamingResponse,
    error,
    activeMode,
    selectedText,
    targetLanguage,
    addMessage,
    setLoading,
    setStreamingResponse,
    appendStreamingResponse,
    setError,
    clearChat,
    getChatHistory,
    finalizeStreamingMessage,
    setActiveMode,
    setSelectedText,
    togglePin,
    getPinnedMessages,
  } = useAIAssistantStore()

  const { getFullContext, currentPosition } = useBookContextStore()

  isLoadingRef.current = isLoading

  const sendMessage = useCallback(
    async (message: string, position?: number, modeOverride?: AIMode) => {
      if (!message.trim() || isLoadingRef.current) return

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      const mode = modeOverride || activeMode

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message.trim(),
        timestamp: Date.now(),
        mode,
      }

      addMessage(bookId, userMessage)
      setLoading(true)
      setError(null)
      setStreamingResponse('')

      try {
        const effectivePosition = position ?? currentPosition
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
            mode,
            selectedText: selectedText || undefined,
            targetLanguage: mode === 'translate' ? targetLanguage : undefined,
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
              } catch {
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

        // Clear selected text after use
        if (selectedText) {
          setSelectedText('')
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
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
      currentPosition,
      activeMode,
      selectedText,
      targetLanguage,
      addMessage,
      setLoading,
      setError,
      setStreamingResponse,
      getFullContext,
      getChatHistory,
      appendStreamingResponse,
      finalizeStreamingMessage,
      setSelectedText,
    ]
  )

  // Quick action helpers
  const summarize = useCallback(
    (position?: number) => {
      sendMessage('Summarize what I\'ve read so far.', position, 'summarize')
    },
    [sendMessage]
  )

  const explain = useCallback(
    (text: string, position?: number) => {
      setSelectedText(text)
      sendMessage(`Explain this: "${text}"`, position, 'explain')
    },
    [sendMessage, setSelectedText]
  )

  const define = useCallback(
    (word: string, position?: number) => {
      setSelectedText(word)
      sendMessage(`Define: "${word}"`, position, 'define')
    },
    [sendMessage, setSelectedText]
  )

  const quiz = useCallback(
    (position?: number) => {
      sendMessage('Quiz me on what I\'ve read so far!', position, 'quiz')
    },
    [sendMessage]
  )

  const analyze = useCallback(
    (position?: number) => {
      sendMessage('Analyze the themes and writing in what I\'ve read so far.', position, 'analyze')
    },
    [sendMessage]
  )

  const translate = useCallback(
    (text: string, position?: number) => {
      setSelectedText(text)
      sendMessage(`Translate this passage.`, position, 'translate')
    },
    [sendMessage, setSelectedText]
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
    activeMode,
    selectedText,
    chatHistory: getChatHistory(bookId),
    pinnedMessages: getPinnedMessages(bookId),
    sendMessage,
    cancelRequest,
    clearChat: clear,
    setActiveMode,
    setSelectedText,
    togglePin: (messageId: string) => togglePin(bookId, messageId),
    // Quick actions
    summarize,
    explain,
    define,
    quiz,
    analyze,
    translate,
  }
}
