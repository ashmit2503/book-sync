'use client'

import { useCallback, useRef } from 'react'
import { useBookContextStore } from '@/lib/stores/bookContextStore'

interface UseTextExtractionOptions {
  bookId: string
  bookType: 'pdf' | 'epub'
}

export function useTextExtraction({ bookId, bookType }: UseTextExtractionOptions) {
  const { addContextChunk, setCurrentBook, updatePosition } = useBookContextStore()
  const extractionQueueRef = useRef<Set<number | string>>(new Set())
  const extractedPagesRef = useRef<Set<number | string>>(new Set())

  // Initialize book context
  const initializeContext = useCallback(() => {
    setCurrentBook(bookId)
  }, [bookId, setCurrentBook])

  // Extract text from PDF page
  const extractPDFPageText = useCallback(
    async (page: any, pageNum: number) => {
      // Skip if already extracted or in queue
      if (extractedPagesRef.current.has(pageNum) || extractionQueueRef.current.has(pageNum)) {
        return
      }

      extractionQueueRef.current.add(pageNum)

      try {
        const textContent = await page.getTextContent()
        const text = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()

        if (text.length > 0) {
          addContextChunk(bookId, {
            pageOrChapter: pageNum,
            text: `[Page ${pageNum}]\n${text}`,
            timestamp: Date.now(),
          })
          extractedPagesRef.current.add(pageNum)
        }
      } catch (error) {
        console.error(`Error extracting text from page ${pageNum}:`, error)
      } finally {
        extractionQueueRef.current.delete(pageNum)
      }
    },
    [bookId, addContextChunk]
  )

  // Extract text from multiple PDF pages (batch extraction)
  const extractPDFPagesUpTo = useCallback(
    async (pdfDoc: any, currentPage: number) => {
      const extractionPromises: Promise<void>[] = []

      // Extract all pages from 1 to currentPage
      for (let i = 1; i <= currentPage; i++) {
        if (!extractedPagesRef.current.has(i) && !extractionQueueRef.current.has(i)) {
          extractionPromises.push(
            (async () => {
              try {
                const page = await pdfDoc.getPage(i)
                await extractPDFPageText(page, i)
              } catch (error) {
                console.error(`Error getting page ${i}:`, error)
              }
            })()
          )
        }
      }

      // Run extractions in parallel (limit concurrency to 3)
      const chunks = []
      for (let i = 0; i < extractionPromises.length; i += 3) {
        chunks.push(extractionPromises.slice(i, i + 3))
      }

      for (const chunk of chunks) {
        await Promise.all(chunk)
      }

      // Update position to the highest page we've fully extracted
      // This ensures AI only sees content that's been processed
      const extractedPages = Array.from(extractedPagesRef.current) as number[]
      const maxExtractedPage = extractedPages.length > 0 
        ? Math.max(...extractedPages.filter(p => p <= currentPage))
        : currentPage
      updatePosition(maxExtractedPage)
    },
    [extractPDFPageText, updatePosition]
  )

  // Extract text from EPUB chapter/section
  // Extracts the current section's text and tracks position
  const extractEPUBText = useCallback(
    async (book: any, rendition: any, percentage: number) => {
      try {
        // Round to nearest integer percentage to avoid too many chunks
        const positionKey = Math.floor(percentage * 100)
        
        // Get current chapter content
        const contents = rendition.getContents()
        
        for (const content of contents) {
          const doc = content.document
          if (!doc) continue

          // Get text from the current view
          const bodyText = doc.body?.innerText || ''
          
          // Only add if we have meaningful text and haven't extracted this position
          if (bodyText.trim().length > 50 && !extractedPagesRef.current.has(positionKey)) {
            addContextChunk(bookId, {
              pageOrChapter: positionKey,
              text: `[${positionKey}%]\n${bodyText.slice(0, 3000)}`, // Limit chunk size
              timestamp: Date.now(),
            })
            extractedPagesRef.current.add(positionKey)
          }
        }

        // Update position to match the current reading position
        // The AI will only get content from positions that have been extracted
        // and are <= the current position
        updatePosition(positionKey)
      } catch (error) {
        console.error('Error extracting EPUB text:', error)
      }
    },
    [bookId, addContextChunk, updatePosition]
  )

  // Get all extracted text so far (for AI context)
  const getExtractedContext = useCallback(() => {
    const { getFullContext, currentPosition } = useBookContextStore.getState()
    return {
      context: getFullContext(bookId),
      position: currentPosition,
    }
  }, [bookId])

  // Reset extraction state (for when book changes)
  const resetExtraction = useCallback(() => {
    extractionQueueRef.current.clear()
    extractedPagesRef.current.clear()
  }, [])

  return {
    initializeContext,
    extractPDFPageText,
    extractPDFPagesUpTo,
    extractEPUBText,
    getExtractedContext,
    resetExtraction,
  }
}
