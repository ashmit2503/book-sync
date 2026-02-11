'use client'

import { create } from 'zustand'

export type AIMode = 'chat' | 'summarize' | 'explain' | 'quiz' | 'define' | 'translate' | 'analyze'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  mode?: AIMode
  pinned?: boolean
}

export type AITab = 'chat' | 'tools'

interface AIAssistantState {
  // Chat messages per book
  chatHistory: Map<string, ChatMessage[]>
  
  // Loading state
  isLoading: boolean
  
  // Current streaming response
  streamingResponse: string
  
  // Error state
  error: string | null

  // Active mode
  activeMode: AIMode

  // Active tab
  activeTab: AITab

  // Selected text from reader
  selectedText: string

  // Whether the panel is open
  isOpen: boolean

  // Whether the panel is minimized
  isMinimized: boolean

  // Target language for translation
  targetLanguage: string
  
  // Actions
  addMessage: (bookId: string, message: ChatMessage) => void
  setLoading: (loading: boolean) => void
  setStreamingResponse: (response: string) => void
  appendStreamingResponse: (chunk: string) => void
  setError: (error: string | null) => void
  clearChat: (bookId: string) => void
  getChatHistory: (bookId: string) => ChatMessage[]
  finalizeStreamingMessage: (bookId: string) => void
  setActiveMode: (mode: AIMode) => void
  setActiveTab: (tab: AITab) => void
  setSelectedText: (text: string) => void
  setIsOpen: (open: boolean) => void
  setIsMinimized: (minimized: boolean) => void
  togglePin: (bookId: string, messageId: string) => void
  getPinnedMessages: (bookId: string) => ChatMessage[]
  setTargetLanguage: (lang: string) => void
}

export const useAIAssistantStore = create<AIAssistantState>((set, get) => ({
  chatHistory: new Map(),
  isLoading: false,
  streamingResponse: '',
  error: null,
  activeMode: 'chat',
  activeTab: 'chat',
  selectedText: '',
  isOpen: false,
  isMinimized: false,
  targetLanguage: 'Spanish',
  
  addMessage: (bookId: string, message: ChatMessage) => {
    set((state) => {
      const newHistory = new Map(state.chatHistory)
      const existing = newHistory.get(bookId) || []
      newHistory.set(bookId, [...existing, message])
      return { chatHistory: newHistory }
    })
  },
  
  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },
  
  setStreamingResponse: (response: string) => {
    set({ streamingResponse: response })
  },
  
  appendStreamingResponse: (chunk: string) => {
    set((state) => ({
      streamingResponse: state.streamingResponse + chunk,
    }))
  },
  
  setError: (error: string | null) => {
    set({ error })
  },
  
  clearChat: (bookId: string) => {
    set((state) => {
      const newHistory = new Map(state.chatHistory)
      newHistory.delete(bookId)
      return { chatHistory: newHistory }
    })
  },
  
  getChatHistory: (bookId: string) => {
    const { chatHistory } = get()
    return chatHistory.get(bookId) || []
  },
  
  finalizeStreamingMessage: (bookId: string) => {
    const { streamingResponse, activeMode } = get()
    if (streamingResponse) {
      const message: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: streamingResponse,
        timestamp: Date.now(),
        mode: activeMode,
      }
      get().addMessage(bookId, message)
      set({ streamingResponse: '' })
    }
  },

  setActiveMode: (mode: AIMode) => {
    set({ activeMode: mode })
  },

  setActiveTab: (tab: AITab) => {
    set({ activeTab: tab })
  },

  setSelectedText: (text: string) => {
    set({ selectedText: text })
  },

  setIsOpen: (open: boolean) => {
    set({ isOpen: open })
  },

  setIsMinimized: (minimized: boolean) => {
    set({ isMinimized: minimized })
  },

  togglePin: (bookId: string, messageId: string) => {
    set((state) => {
      const newHistory = new Map(state.chatHistory)
      const messages = newHistory.get(bookId) || []
      const updated = messages.map((m) =>
        m.id === messageId ? { ...m, pinned: !m.pinned } : m
      )
      newHistory.set(bookId, updated)
      return { chatHistory: newHistory }
    })
  },

  getPinnedMessages: (bookId: string) => {
    const { chatHistory } = get()
    return (chatHistory.get(bookId) || []).filter((m) => m.pinned)
  },

  setTargetLanguage: (lang: string) => {
    set({ targetLanguage: lang })
  },
}))
