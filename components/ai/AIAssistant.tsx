'use client'

import { useState, useRef, useEffect } from 'react'
import { useAIChat } from '@/lib/hooks/useAIChat'
import { useBookContextStore } from '@/lib/stores/bookContextStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  StopCircle,
} from 'lucide-react'

interface AIAssistantProps {
  bookId: string
  bookTitle: string
  bookAuthor?: string
  theme?: 'light' | 'dark' | 'sepia'
  position?: number // Current reading position (page or percentage)
}

export function AIAssistant({
  bookId,
  bookTitle,
  bookAuthor,
  theme = 'light',
  position = 0,
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    isLoading,
    streamingResponse,
    error,
    chatHistory,
    sendMessage,
    cancelRequest,
    clearChat,
  } = useAIChat({ bookId, bookTitle, bookAuthor })

  const { hasContext, currentPosition } = useBookContextStore()
  const hasBookContext = hasContext(bookId)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isOpen && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory, streamingResponse, isOpen, isMinimized])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, isMinimized])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return
    const message = inputValue.trim()
    setInputValue('')
    await sendMessage(message, position || currentPosition)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Theme-based styles
  const themeStyles = {
    light: {
      bg: 'bg-white',
      border: 'border-gray-200',
      text: 'text-gray-900',
      subtext: 'text-gray-500',
      userBubble: 'bg-primary text-primary-foreground',
      assistantBubble: 'bg-gray-100 text-gray-900',
      input: 'bg-white border-gray-200',
    },
    dark: {
      bg: 'bg-gray-800',
      border: 'border-gray-700',
      text: 'text-gray-100',
      subtext: 'text-gray-400',
      userBubble: 'bg-primary text-primary-foreground',
      assistantBubble: 'bg-gray-700 text-gray-100',
      input: 'bg-gray-700 border-gray-600 text-gray-100',
    },
    sepia: {
      bg: 'bg-[#f4ecd8]',
      border: 'border-[#d4c4a8]',
      text: 'text-[#5c4a3a]',
      subtext: 'text-[#8b7355]',
      userBubble: 'bg-[#8b7355] text-white',
      assistantBubble: 'bg-[#e8dcc8] text-[#5c4a3a]',
      input: 'bg-white border-[#d4c4a8]',
    },
  }

  const styles = themeStyles[theme]

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
        title="AI Reading Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-lg shadow-2xl transition-all duration-200 ${styles.bg} ${styles.border} border`}
      style={{
        width: isMinimized ? '280px' : '380px',
        height: isMinimized ? '48px' : '500px',
        maxHeight: 'calc(100vh - 150px)',
      }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${styles.border} cursor-pointer`}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className={`font-semibold ${styles.text}`}>AI Assistant</span>
          {!hasBookContext && (
            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">
              Reading...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isMinimized && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                clearChat()
              }}
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              setIsMinimized(!isMinimized)
            }}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 && !streamingResponse && (
              <div className={`text-center py-8 ${styles.subtext}`}>
                <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  Ask me anything about what you've read so far!
                </p>
                <p className="text-xs mt-2 opacity-70">
                  I only know about the content you've already read.
                </p>
              </div>
            )}

            {chatHistory.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? styles.userBubble
                      : styles.assistantBubble
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {/* Streaming response */}
            {streamingResponse && (
              <div className="flex justify-start">
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${styles.assistantBubble}`}
                >
                  <p className="text-sm whitespace-pre-wrap">{streamingResponse}</p>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingResponse && (
              <div className="flex justify-start">
                <div
                  className={`rounded-lg px-4 py-2 ${styles.assistantBubble}`}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm p-3 bg-red-50 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`p-3 border-t ${styles.border}`}>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={hasBookContext ? "Ask about what you've read..." : 'Keep reading to enable AI...'}
                className={`flex-1 ${styles.input}`}
                disabled={isLoading || !hasBookContext}
              />
              {isLoading ? (
                <Button
                  onClick={cancelRequest}
                  size="icon"
                  variant="destructive"
                  title="Stop"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || !hasBookContext}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className={`text-xs mt-2 ${styles.subtext}`}>
              📖 Position: {Math.round(position || currentPosition)}%
            </p>
          </div>
        </>
      )}
    </div>
  )
}
