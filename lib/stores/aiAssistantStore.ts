'use client'

import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AIAssistantState {
  // Chat messages per book
  chatHistory: Map<string, ChatMessage[]>
  
  // Loading state
  isLoading: boolean
  
  // Current streaming response
  streamingResponse: string
  
  // Error state
  error: string | null
  
  // Actions
  addMessage: (bookId: string, message: ChatMessage) => void
  setLoading: (loading: boolean) => void
  setStreamingResponse: (response: string) => void
  appendStreamingResponse: (chunk: string) => void
  setError: (error: string | null) => void
  clearChat: (bookId: string) => void
  getChatHistory: (bookId: string) => ChatMessage[]
  finalizeStreamingMessage: (bookId: string) => void
}

export const useAIAssistantStore = create<AIAssistantState>((set, get) => ({
  chatHistory: new Map(),
  isLoading: false,
  streamingResponse: '',
  error: null,
  
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
    const { streamingResponse } = get()
    if (streamingResponse) {
      const message: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: streamingResponse,
        timestamp: Date.now(),
      }
      get().addMessage(bookId, message)
      set({ streamingResponse: '' })
    }
  },
}))
