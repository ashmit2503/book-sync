'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAIChat } from '@/lib/hooks/useAIChat'
import { useBookContextStore } from '@/lib/stores/bookContextStore'
import { useAIAssistantStore, AIMode } from '@/lib/stores/aiAssistantStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  StopCircle,
  BookOpen,
  Brain,
  HelpCircle,
  Languages,
  Search,
  Pin,
  PinOff,
  Copy,
  Check,
  Lightbulb,
  GraduationCap,
  FileText,
  Wand2,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'

interface AIAssistantProps {
  bookId: string
  bookTitle: string
  bookAuthor?: string
  theme?: 'light' | 'dark' | 'sepia'
  position?: number
}

// Mode configuration
const modeConfig: Record<
  AIMode,
  { label: string; icon: LucideIcon; description: string; color: string }
> = {
  chat: {
    label: 'Chat',
    icon: MessageCircle,
    description: 'Ask anything about the book',
    color: 'text-blue-500',
  },
  summarize: {
    label: 'Summarize',
    icon: FileText,
    description: 'Get a summary of what you\'ve read',
    color: 'text-emerald-500',
  },
  explain: {
    label: 'Explain',
    icon: Lightbulb,
    description: 'Explain a concept or passage',
    color: 'text-amber-500',
  },
  quiz: {
    label: 'Quiz',
    icon: GraduationCap,
    description: 'Test your understanding',
    color: 'text-purple-500',
  },
  define: {
    label: 'Define',
    icon: Search,
    description: 'Look up a word or term',
    color: 'text-cyan-500',
  },
  translate: {
    label: 'Translate',
    icon: Languages,
    description: 'Translate a passage',
    color: 'text-rose-500',
  },
  analyze: {
    label: 'Analyze',
    icon: Brain,
    description: 'Deep literary analysis',
    color: 'text-orange-500',
  },
}

// Simple markdown-like renderer
function RichText({ content, className = '' }: { content: string; className?: string }) {
  const parts = useMemo(() => {
    const lines = content.split('\n')
    return lines.map((line, i) => {
      // Bold
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      processed = processed.replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-xs font-mono">$1</code>')

      // Headers
      if (line.startsWith('### ')) {
        return (
          <h4 key={i} className="font-semibold text-sm mt-3 mb-1" dangerouslySetInnerHTML={{ __html: processed.slice(4) }} />
        )
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={i} className="font-bold text-sm mt-3 mb-1" dangerouslySetInnerHTML={{ __html: processed.slice(3) }} />
        )
      }

      // Bullet points
      if (line.match(/^[-•*]\s/)) {
        return (
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: processed.replace(/^[-•*]\s/, '') }} />
          </div>
        )
      }

      // Numbered list
      if (line.match(/^\d+\.\s/)) {
        const match = line.match(/^(\d+)\.\s(.*)/)
        if (match) {
          return (
            <div key={i} className="flex gap-2 ml-2 my-0.5">
              <span className="text-primary font-medium shrink-0">{match[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: processed.replace(/^\d+\.\s/, '') }} />
            </div>
          )
        }
      }

      // Empty lines
      if (line.trim() === '') {
        return <div key={i} className="h-2" />
      }

      return (
        <p key={i} className="my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
      )
    })
  }, [content])

  return <div className={`text-sm leading-relaxed ${className}`}>{parts}</div>
}

// Copy button for messages
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-50" />
      )}
    </button>
  )
}

export function AIAssistant({
  bookId,
  bookTitle,
  bookAuthor,
  theme = 'light',
  position = 0,
}: AIAssistantProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const {
    isOpen,
    isMinimized,
    activeTab,
    activeMode,
    selectedText,
    setIsOpen,
    setIsMinimized,
    setActiveTab,
    setActiveMode,
    setSelectedText,
  } = useAIAssistantStore()

  const {
    isLoading,
    streamingResponse,
    error,
    chatHistory,
    pinnedMessages,
    sendMessage,
    cancelRequest,
    clearChat,
    togglePin,
    summarize,
    quiz,
    analyze,
  } = useAIChat({ bookId, bookTitle, bookAuthor })

  const { hasContext, currentPosition } = useBookContextStore()
  const hasBookContext = hasContext(bookId)

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current && isOpen && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory, streamingResponse, isOpen, isMinimized])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized, activeTab])

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

  const handleQuickAction = (mode: AIMode) => {
    setActiveMode(mode)
    setActiveTab('chat')

    if (mode === 'summarize') {
      summarize(position || currentPosition)
    } else if (mode === 'quiz') {
      quiz(position || currentPosition)
    } else if (mode === 'analyze') {
      analyze(position || currentPosition)
    }
  }

  // Theme-based styles
  const isDark = theme === 'dark'
  const isSepia = theme === 'sepia'

  const themeClasses = {
    bg: isDark
      ? 'bg-gray-900/95 backdrop-blur-xl'
      : isSepia
      ? 'bg-[#f9f3e8]/95 backdrop-blur-xl'
      : 'bg-white/95 backdrop-blur-xl',
    border: isDark
      ? 'border-gray-700/50'
      : isSepia
      ? 'border-[#d4c4a8]/50'
      : 'border-gray-200/50',
    text: isDark
      ? 'text-gray-100'
      : isSepia
      ? 'text-[#5c4a3a]'
      : 'text-gray-900',
    subtext: isDark
      ? 'text-gray-400'
      : isSepia
      ? 'text-[#8b7355]'
      : 'text-gray-500',
    userBubble: isDark
      ? 'bg-blue-600 text-white'
      : isSepia
      ? 'bg-[#8b7355] text-white'
      : 'bg-blue-600 text-white',
    assistantBubble: isDark
      ? 'bg-gray-800 text-gray-100 border border-gray-700/50'
      : isSepia
      ? 'bg-[#efe5d4] text-[#5c4a3a] border border-[#d4c4a8]/30'
      : 'bg-gray-50 text-gray-900 border border-gray-100',
    input: isDark
      ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500'
      : isSepia
      ? 'bg-white border-[#d4c4a8] placeholder:text-[#8b7355]/60'
      : 'bg-white border-gray-200 placeholder:text-gray-400',
    hover: isDark ? 'hover:bg-gray-800' : isSepia ? 'hover:bg-[#efe5d4]' : 'hover:bg-gray-50',
    cardBg: isDark ? 'bg-gray-800/80' : isSepia ? 'bg-[#efe5d4]/80' : 'bg-gray-50/80',
  }

  // --- FAB Button ---
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 group flex items-center gap-2 rounded-full px-4 py-3 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95 ${
          isDark
            ? 'bg-blue-600 text-white'
            : 'bg-blue-600 text-white'
        }`}
        title="AI Reading Assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium hidden sm:inline">AI Assistant</span>
        {selectedText && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full animate-pulse" />
        )}
      </button>
    )
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl shadow-black/10 transition-all duration-300 ease-out ${themeClasses.bg} ${themeClasses.border} border overflow-hidden`}
      style={{
        width: isMinimized ? '260px' : '420px',
        height: isMinimized ? '52px' : '560px',
        maxHeight: 'calc(100vh - 100px)',
      }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${themeClasses.border} cursor-pointer select-none shrink-0`}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Sparkles className="h-5 w-5 text-blue-500" />
            {isLoading && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
          <div className="flex flex-col">
            <span className={`font-semibold text-sm leading-tight ${themeClasses.text}`}>
              AI Assistant
            </span>
            {!isMinimized && (
              <span className={`text-[10px] leading-tight ${themeClasses.subtext}`}>
                {modeConfig[activeMode].label} mode • {Math.round(position || currentPosition)}% read
              </span>
            )}
          </div>
          {!hasBookContext && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              Reading...
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {!isMinimized && chatHistory.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={(e) => {
                e.stopPropagation()
                clearChat()
              }}
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={(e) => {
              e.stopPropagation()
              setIsMinimized(!isMinimized)
            }}
          >
            {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Tab switcher */}
          <div className={`flex border-b ${themeClasses.border} shrink-0`}>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === 'chat'
                  ? `${themeClasses.text}`
                  : `${themeClasses.subtext} ${themeClasses.hover}`
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
              {activeTab === 'chat' && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === 'tools'
                  ? `${themeClasses.text}`
                  : `${themeClasses.subtext} ${themeClasses.hover}`
              }`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Tools
              {activeTab === 'tools' && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Selected text banner */}
          {selectedText && (
            <div
              className={`mx-3 mt-2 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${themeClasses.cardBg} ${themeClasses.border}`}
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className={`font-medium ${themeClasses.text}`}>Selected text:</span>
                <p className={`${themeClasses.subtext} line-clamp-2 mt-0.5`}>
                  &ldquo;{selectedText}&rdquo;
                </p>
              </div>
              <button
                onClick={() => setSelectedText('')}
                className="shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-3 w-3 opacity-50" />
              </button>
            </div>
          )}

          {activeTab === 'tools' ? (
            /* Tools Tab */
            <div className="flex-1 overflow-y-auto p-3">
              {/* Quick actions grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(Object.entries(modeConfig) as [AIMode, typeof modeConfig[AIMode]][])
                  .filter(([key]) => key !== 'chat')
                  .map(([mode, config]) => {
                    const Icon = config.icon
                    const isActive = activeMode === mode
                    return (
                      <button
                        key={mode}
                        onClick={() => handleQuickAction(mode)}
                        disabled={!hasBookContext || isLoading}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                          isActive
                            ? `${themeClasses.cardBg} ${themeClasses.border} shadow-sm ring-1 ring-blue-500/20`
                            : `${themeClasses.border} border-transparent ${themeClasses.hover}`
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <span className={`font-medium ${themeClasses.text}`}>{config.label}</span>
                        <span className={`text-[10px] ${themeClasses.subtext} text-center leading-tight`}>
                          {config.description}
                        </span>
                      </button>
                    )
                  })}
              </div>

              {/* Pinned messages */}
              {pinnedMessages.length > 0 && (
                <div className="mt-2">
                  <h4 className={`text-xs font-semibold ${themeClasses.subtext} mb-2 flex items-center gap-1.5`}>
                    <Pin className="h-3 w-3" /> Pinned responses
                  </h4>
                  <div className="space-y-2">
                    {pinnedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded-lg border ${themeClasses.cardBg} ${themeClasses.border}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          {msg.mode && (
                            <span className={`text-[10px] font-medium ${modeConfig[msg.mode].color}`}>
                              {modeConfig[msg.mode].label}
                            </span>
                          )}
                          <button
                            onClick={() => togglePin(msg.id)}
                            className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <PinOff className="h-3 w-3 opacity-50" />
                          </button>
                        </div>
                        <p className={`text-xs ${themeClasses.text} line-clamp-3`}>
                          {msg.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested prompts */}
              <div className="mt-4">
                <h4 className={`text-xs font-semibold ${themeClasses.subtext} mb-2 flex items-center gap-1.5`}>
                  <HelpCircle className="h-3 w-3" /> Suggested prompts
                </h4>
                <div className="space-y-1.5">
                  {[
                    'What are the main themes so far?',
                    'Who are the key characters introduced?',
                    'What is the setting of the story?',
                    'What happened in this section?',
                    'What literary devices are being used?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setActiveTab('chat')
                        setActiveMode('chat')
                        setInputValue(prompt)
                        // Auto-send after switching tabs
                        setTimeout(() => inputRef.current?.focus(), 100)
                      }}
                      disabled={!hasBookContext}
                      className={`w-full text-left text-xs p-2.5 rounded-lg transition-colors disabled:opacity-40 ${themeClasses.hover} ${themeClasses.text}`}
                    >
                      <span className="opacity-50 mr-1">→</span> {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Tab */
            <>
              {/* Mode selector pills */}
              <div className={`flex gap-1 px-3 py-2 overflow-x-auto shrink-0 scrollbar-none`}>
                {(Object.entries(modeConfig) as [AIMode, typeof modeConfig[AIMode]][]).map(
                  ([mode, config]) => {
                    const Icon = config.icon
                    const isActive = activeMode === mode
                    return (
                      <button
                        key={mode}
                        onClick={() => setActiveMode(mode)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 ${
                          isActive
                            ? `bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20`
                            : `${themeClasses.subtext} ${themeClasses.hover}`
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </button>
                    )
                  }
                )}
              </div>

              {/* Messages */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                {chatHistory.length === 0 && !streamingResponse && (
                  <div className={`text-center py-10 ${themeClasses.subtext}`}>
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 mb-4">
                      <Sparkles className="h-7 w-7 text-blue-500" />
                    </div>
                    <p className="text-sm font-medium mb-1">
                      {activeMode === 'chat'
                        ? 'Ask me anything!'
                        : `${modeConfig[activeMode].label} Mode`}
                    </p>
                    <p className="text-xs opacity-70 max-w-[240px] mx-auto">
                      {modeConfig[activeMode].description}. I only know about what you&apos;ve read so far.
                    </p>
                    {hasBookContext && activeMode === 'chat' && (
                      <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                        {['What\'s happening?', 'Summarize this', 'Who is...?'].map((q) => (
                          <button
                            key={q}
                            onClick={() => setInputValue(q)}
                            className={`text-[11px] px-3 py-1.5 rounded-full border ${themeClasses.border} ${themeClasses.hover} transition-colors`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {chatHistory.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                        message.role === 'user'
                          ? `${themeClasses.userBubble} rounded-br-md`
                          : `${themeClasses.assistantBubble} rounded-bl-md`
                      }`}
                    >
                      {/* Mode badge for assistant */}
                      {message.role === 'assistant' && message.mode && message.mode !== 'chat' && (
                        <div className="flex items-center gap-1 mb-1.5">
                          {(() => {
                            const ModeIcon = modeConfig[message.mode].icon
                            return <ModeIcon className={`h-3 w-3 ${modeConfig[message.mode].color}`} />
                          })()}
                          <span className={`text-[10px] font-medium ${modeConfig[message.mode].color}`}>
                            {modeConfig[message.mode].label}
                          </span>
                        </div>
                      )}

                      {message.role === 'assistant' ? (
                        <RichText content={message.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}

                      {/* Action bar for assistant messages */}
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-1 mt-2 -mb-0.5">
                          <CopyButton text={message.content} />
                          <button
                            onClick={() => togglePin(message.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                            title={message.pinned ? 'Unpin' : 'Pin'}
                          >
                            {message.pinned ? (
                              <PinOff className="h-3 w-3 text-blue-500" />
                            ) : (
                              <Pin className="h-3 w-3 opacity-50" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming response */}
                {streamingResponse && (
                  <div className="flex justify-start">
                    <div className={`max-w-[88%] rounded-2xl rounded-bl-md px-3.5 py-2.5 ${themeClasses.assistantBubble}`}>
                      {activeMode !== 'chat' && (
                        <div className="flex items-center gap-1 mb-1.5">
                          {(() => {
                            const ModeIcon = modeConfig[activeMode].icon
                            return <ModeIcon className={`h-3 w-3 ${modeConfig[activeMode].color}`} />
                          })()}
                          <span className={`text-[10px] font-medium ${modeConfig[activeMode].color}`}>
                            {modeConfig[activeMode].label}
                          </span>
                        </div>
                      )}
                      <RichText content={streamingResponse} />
                      <span className="inline-block w-1.5 h-4 bg-blue-500 rounded-full animate-pulse ml-0.5 align-middle" />
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {isLoading && !streamingResponse && (
                  <div className="flex justify-start">
                    <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${themeClasses.assistantBubble}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className={`text-xs ${themeClasses.subtext}`}>Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div
                    className={`flex items-start gap-2.5 text-sm p-3.5 rounded-xl ${
                      isDark ? 'bg-red-900/20 text-red-400 border border-red-800/30' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs">{error}</p>
                      <button
                        onClick={() => {
                          const lastUserMsg = [...chatHistory].reverse().find((m) => m.role === 'user')
                          if (lastUserMsg) {
                            sendMessage(lastUserMsg.content, position || currentPosition)
                          }
                        }}
                        className="text-xs mt-1.5 flex items-center gap-1 font-medium hover:underline"
                      >
                        <RotateCcw className="h-3 w-3" /> Retry
                      </button>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className={`p-3 border-t ${themeClasses.border} shrink-0`}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={
                        !hasBookContext
                          ? 'Keep reading to enable AI...'
                          : activeMode === 'define'
                          ? 'Enter a word or phrase...'
                          : activeMode === 'translate'
                          ? 'Enter text to translate...'
                          : 'Ask anything...'
                      }
                      className={`pr-10 rounded-xl text-sm h-10 ${themeClasses.input}`}
                      disabled={isLoading || !hasBookContext}
                    />
                  </div>
                  {isLoading ? (
                    <Button
                      onClick={cancelRequest}
                      size="icon"
                      variant="destructive"
                      className="h-10 w-10 rounded-xl shrink-0"
                      title="Stop"
                    >
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || !hasBookContext}
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
