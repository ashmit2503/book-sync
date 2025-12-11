'use client'

import { create } from 'zustand'

interface BookContextChunk {
  pageOrChapter: number | string
  text: string
  timestamp: number
}

interface BookContextState {
  // Context storage - all text read so far
  contextChunks: Map<string, BookContextChunk[]>
  
  // Current book being read
  currentBookId: string | null
  
  // Reading position for context boundary
  currentPosition: number // For PDF: page number, For EPUB: percentage * 100
  
  // Actions
  setCurrentBook: (bookId: string) => void
  addContextChunk: (bookId: string, chunk: BookContextChunk) => void
  getContextUpToPosition: (bookId: string, position: number) => string
  clearContext: (bookId: string) => void
  updatePosition: (position: number) => void
  
  // Get full context as a single string (optionally up to a specific position)
  getFullContext: (bookId: string, upToPosition?: number) => string
  
  // Check if we have context for a book
  hasContext: (bookId: string) => boolean
}

export const useBookContextStore = create<BookContextState>((set, get) => ({
  contextChunks: new Map(),
  currentBookId: null,
  currentPosition: 0,
  
  setCurrentBook: (bookId: string) => {
    set({ currentBookId: bookId })
    // Initialize context array if it doesn't exist
    const { contextChunks } = get()
    if (!contextChunks.has(bookId)) {
      const newChunks = new Map(contextChunks)
      newChunks.set(bookId, [])
      set({ contextChunks: newChunks })
    }
  },
  
  addContextChunk: (bookId: string, chunk: BookContextChunk) => {
    set((state) => {
      const newChunks = new Map(state.contextChunks)
      const existing = newChunks.get(bookId) || []
      
      // Check if we already have this chunk (by page/chapter)
      const existingIndex = existing.findIndex(
        (c) => c.pageOrChapter === chunk.pageOrChapter
      )
      
      if (existingIndex >= 0) {
        // Update existing chunk if new text is longer
        if (chunk.text.length > existing[existingIndex].text.length) {
          existing[existingIndex] = chunk
        }
      } else {
        // Add new chunk
        existing.push(chunk)
        // Sort by page/chapter
        existing.sort((a, b) => {
          const aNum = typeof a.pageOrChapter === 'number' ? a.pageOrChapter : parseFloat(a.pageOrChapter) || 0
          const bNum = typeof b.pageOrChapter === 'number' ? b.pageOrChapter : parseFloat(b.pageOrChapter) || 0
          return aNum - bNum
        })
      }
      
      newChunks.set(bookId, existing)
      return { contextChunks: newChunks }
    })
  },
  
  getContextUpToPosition: (bookId: string, position: number) => {
    const { contextChunks } = get()
    const chunks = contextChunks.get(bookId) || []
    
    // Filter chunks up to the current position
    const relevantChunks = chunks.filter((chunk) => {
      const chunkPos = typeof chunk.pageOrChapter === 'number' 
        ? chunk.pageOrChapter 
        : parseFloat(chunk.pageOrChapter) || 0
      return chunkPos <= position
    })
    
    // Combine text from all relevant chunks
    return relevantChunks.map((c) => c.text).join('\n\n')
  },
  
  clearContext: (bookId: string) => {
    set((state) => {
      const newChunks = new Map(state.contextChunks)
      newChunks.delete(bookId)
      return { contextChunks: newChunks }
    })
  },
  
  updatePosition: (position: number) => {
    set({ currentPosition: position })
  },
  
  // Get full context as a single string up to a specific position
  getFullContext: (bookId: string, upToPosition?: number) => {
    const { contextChunks } = get()
    const chunks = contextChunks.get(bookId) || []
    
    // If no position specified, use a very high number to include all
    // If position specified, strictly limit to that position
    const maxPosition = upToPosition !== undefined ? upToPosition : Number.MAX_SAFE_INTEGER
    
    // STRICT: Only get context up to specified position (not ahead)
    // This ensures AI never knows content beyond what user has read
    const relevantChunks = chunks.filter((chunk) => {
      const chunkPos = typeof chunk.pageOrChapter === 'number' 
        ? chunk.pageOrChapter 
        : parseFloat(chunk.pageOrChapter) || 0
      // Use strict less-than-or-equal to ensure we don't include future content
      return chunkPos <= maxPosition
    })
    
    // Sort to ensure correct order
    relevantChunks.sort((a, b) => {
      const aNum = typeof a.pageOrChapter === 'number' ? a.pageOrChapter : parseFloat(a.pageOrChapter) || 0
      const bNum = typeof b.pageOrChapter === 'number' ? b.pageOrChapter : parseFloat(b.pageOrChapter) || 0
      return aNum - bNum
    })
    
    return relevantChunks.map((c) => c.text).join('\n\n')
  },
  
  hasContext: (bookId: string) => {
    const { contextChunks } = get()
    const chunks = contextChunks.get(bookId) || []
    return chunks.length > 0
  },
}))
