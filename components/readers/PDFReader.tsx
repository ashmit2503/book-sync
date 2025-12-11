'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useReadingProgress } from '@/lib/hooks/useReadingProgress'
import { useTextExtraction } from '@/lib/hooks/useTextExtraction'
import { useReadingSession } from '@/lib/hooks/useReadingSession'
import { useUserPreferences } from '@/lib/hooks/useUserPreferences'
import { useTheme } from '@/components/providers/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { getCachedPDF, cachePDF } from '@/lib/utils/pdfCache'
import { AIAssistant } from '@/components/ai/AIAssistant'
import { CopyPopup } from '@/components/ui/CopyPopup'
import { TextToSpeech } from '@/components/readers/TextToSpeech'
import {
  ZoomIn,
  ZoomOut,
  Loader2,
  Maximize,
  Minimize,
  RotateCw,
  Columns,
  AlignJustify,
  ArrowLeft,
  Settings2,
  Volume2,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

// Average reading speed (words per minute) for time estimation
const AVERAGE_WPM = 250
const WORDS_PER_PAGE = 300 // Estimated words per PDF page

interface PDFReaderProps {
  bookId: string
  fileUrl: string
  bookTitle?: string
  bookAuthor?: string
}

type ScrollMode = 'vertical' | 'horizontal'

interface SavedPosition {
  currentPage: number
  pageOffsetPercent: number  // Percentage offset within the current page
  scrollPercentage: number   // Overall scroll percentage (for fallback)
  timestamp: number
}

export function PDFReader({ bookId, fileUrl, bookTitle, bookAuthor }: PDFReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderingPages = useRef<Set<number>>(new Set())
  const renderedPages = useRef<Set<number>>(new Set())
  const positionRestoredRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastScrollTopRef = useRef(0)

  // User preferences
  const { preferences, isLoading: preferencesLoading } = useUserPreferences()

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Loading PDF...')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState(fileUrl)
  const [hasRetried, setHasRetried] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [scrollMode, setScrollMode] = useState<ScrollMode>('vertical')
  const [currentPage, setCurrentPage] = useState(1)
  const [showTTS, setShowTTS] = useState(false)
  const [currentPageText, setCurrentPageText] = useState('')
  const [showReadingTime, setShowReadingTime] = useState(true)
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(0) // in minutes

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { progress, updateProgress, isLoading: progressLoading } = useReadingProgress(bookId)

  // Apply user preferences on load
  useEffect(() => {
    if (!preferencesLoading && preferences) {
      // Apply zoom based on font size preference (scale mapping)
      const preferredScale = (preferences.font_size / 100) * 1.2
      setScale(Math.max(0.5, Math.min(4, preferredScale)))
      setScrollMode(preferences.scroll_mode)
      setShowReadingTime(preferences.show_reading_time)
      // Enable TTS panel if user has it enabled
      if (preferences.enable_tts) {
        setShowTTS(true)
      }
    }
  }, [preferencesLoading, preferences])

  // Calculate reading time based on number of pages
  useEffect(() => {
    if (numPages > 0) {
      const remainingPages = numPages - currentPage
      const remainingMinutes = Math.ceil((remainingPages * WORDS_PER_PAGE) / AVERAGE_WPM)
      setEstimatedTimeLeft(remainingMinutes)
    }
  }, [numPages, currentPage])

  // Reading session tracking
  const { startSession, endSession } = useReadingSession({ bookId })

  // Start session when component mounts (after loading), end when unmounts
  useEffect(() => {
    if (!loading) {
      startSession()
    }
    return () => {
      endSession()
    }
  }, [loading, startSession, endSession])

  // Text extraction for AI assistant
  const {
    initializeContext,
    extractPDFPagesUpTo,
    resetExtraction,
  } = useTextExtraction({ bookId, bookType: 'pdf' })

  // Initialize context on mount
  useEffect(() => {
    initializeContext()
    return () => {
      resetExtraction()
    }
  }, [initializeContext, resetExtraction])

  // Extract text from current page for TTS
  const extractCurrentPageText = useCallback(async () => {
    if (!pdfDoc) return
    
    try {
      const page = await pdfDoc.getPage(currentPage)
      const textContent = await page.getTextContent()
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      setCurrentPageText(text)
    } catch (error) {
      console.warn('[PDFReader] Failed to extract page text:', error)
    }
  }, [pdfDoc, currentPage])

  // Extract text when page changes
  useEffect(() => {
    extractCurrentPageText()
  }, [extractCurrentPageText])

  // Get saved position from localStorage for precise restoration
  const getSavedPosition = useCallback((): SavedPosition | null => {
    try {
      const saved = localStorage.getItem(`book-${bookId}-position`)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to get saved position:', e)
    }
    return null
  }, [bookId])

  // Save position to localStorage for precise restoration
  const savePosition = useCallback((page: number, pageOffsetPercent: number, scrollPercentage: number) => {
    try {
      const position: SavedPosition = {
        currentPage: page,
        pageOffsetPercent,
        scrollPercentage,
        timestamp: Date.now(),
      }
      localStorage.setItem(`book-${bookId}-position`, JSON.stringify(position))
    } catch (e) {
      console.error('Failed to save position:', e)
    }
  }, [bookId])

  // Load PDF document with caching
  useEffect(() => {
    let cancelled = false

    async function loadPDF() {
      try {
        setLoading(true)

        // Try to load from cache first
        setLoadingMessage('Checking cache...')
        const cachedData = await getCachedPDF(bookId)
        
        let pdfData: ArrayBuffer
        
        if (cachedData) {
          setLoadingMessage('Loading from cache...')
          pdfData = cachedData
        } else {
          setLoadingMessage('Downloading PDF...')
          // Fetch the PDF
          const response = await fetch(signedUrl)
          if (!response.ok) {
            throw new Error('Failed to fetch PDF')
          }
          pdfData = await response.arrayBuffer()
          
          // Cache for future use
          setLoadingMessage('Caching for offline use...')
          await cachePDF(bookId, pdfData)
        }

        if (cancelled) return

        setLoadingMessage('Rendering PDF...')
        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise

        if (cancelled) return

        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        
        // Calculate optimal initial scale to fit the page
        if (scrollContainerRef.current) {
          try {
            const firstPage = await pdf.getPage(1)
            const defaultViewport = firstPage.getViewport({ scale: 1, rotation: 0 })
            const containerHeight = window.innerHeight - 200 // Account for toolbar and margins
            const containerWidth = scrollContainerRef.current.clientWidth - 150 // Account for nav buttons
            
            const scaleToFitHeight = containerHeight / defaultViewport.height
            const scaleToFitWidth = containerWidth / defaultViewport.width
            const optimalScale = Math.min(scaleToFitHeight, scaleToFitWidth, 2.5) // Cap at 2.5x
            
            setScale(Math.max(1, optimalScale)) // At least 1x scale
          } catch (e) {
            console.warn('Could not calculate optimal scale:', e)
          }
        }
        
        setLoading(false)
      } catch (error) {
        if (cancelled) return
        console.error('Error loading PDF:', error)
        setErrorMessage('Unable to load PDF. The file URL may be expired.')
        setLoading(false)
      }
    }

    if (signedUrl) {
      loadPDF()
    }

    return () => {
      cancelled = true
    }
  }, [signedUrl, bookId])

  // Retry on error
  useEffect(() => {
    if (!errorMessage || hasRetried) return

    async function refreshUrl() {
      try {
        const res = await fetch(`/api/books/${bookId}/download`)
        if (!res.ok) return
        const data = await res.json()
        if (data?.url) {
          setHasRetried(true)
          setSignedUrl(data.url)
          setErrorMessage(null)
        }
      } catch (err) {
        console.error('Failed to refresh signed URL', err)
      }
    }

    refreshUrl()
  }, [errorMessage, hasRetried, bookId])

  // Render a page
  const renderPage = useCallback(async (pageNum: number, pdf: pdfjsLib.PDFDocumentProxy) => {
    if (renderingPages.current.has(pageNum) || renderedPages.current.has(pageNum)) return

    const canvas = canvasRefs.current.get(pageNum)
    if (!canvas) return

    renderingPages.current.add(pageNum)

    try {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale, rotation })

      canvas.height = viewport.height
      canvas.width = viewport.width

      const context = canvas.getContext('2d')
      if (!context) return

      await page.render({
        canvasContext: context,
        viewport,
      }).promise

      renderedPages.current.add(pageNum)
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error)
    } finally {
      renderingPages.current.delete(pageNum)
    }
  }, [scale, rotation])

  // Render visible pages
  const renderVisiblePages = useCallback(() => {
    if (!pdfDoc || !scrollContainerRef.current) return

    const container = scrollContainerRef.current

    // In Page Flip mode, only render the current page
    if (scrollMode === 'horizontal') {
      renderPage(currentPage, pdfDoc)
      return
    }

    // Vertical scroll mode - render visible pages
    const containerRect = container.getBoundingClientRect()

    // Find visible pages (with buffer for smoother scrolling)
    for (let i = 1; i <= numPages; i++) {
      const pageEl = container.querySelector(`[data-page="${i}"]`) as HTMLElement
      if (!pageEl) continue

      const pageRect = pageEl.getBoundingClientRect()
      const isVisible = 
        pageRect.bottom > containerRect.top - 800 &&
        pageRect.top < containerRect.bottom + 800

      if (isVisible) {
        renderPage(i, pdfDoc)
      }
    }

    // Determine current page based on visibility
    let mostVisiblePage = 1
    let maxVisibility = 0

    for (let i = 1; i <= numPages; i++) {
      const pageEl = container.querySelector(`[data-page="${i}"]`) as HTMLElement
      if (!pageEl) continue

      const pageRect = pageEl.getBoundingClientRect()
      const visibleTop = Math.max(pageRect.top, containerRect.top)
      const visibleBottom = Math.min(pageRect.bottom, containerRect.bottom)
      const visibleHeight = Math.max(0, visibleBottom - visibleTop)

      if (visibleHeight > maxVisibility) {
        maxVisibility = visibleHeight
        mostVisiblePage = i
      }
    }

    setCurrentPage(mostVisiblePage)
  // Note: currentPage excluded to prevent render loops - we read it via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, numPages, renderPage, scrollMode])

  // Re-render when page changes in Page Flip mode or when scale/rotation changes
  useEffect(() => {
    if (scrollMode === 'horizontal' && pdfDoc) {
      // Clear previous page from rendered set to force re-render
      renderedPages.current.clear()
      renderPage(currentPage, pdfDoc)
    }
  }, [currentPage, scrollMode, pdfDoc, renderPage, scale, rotation])

  // Extract text for AI assistant when current page changes
  useEffect(() => {
    if (pdfDoc && currentPage > 0 && positionRestoredRef.current) {
      // Extract text from all pages up to the current page
      extractPDFPagesUpTo(pdfDoc, currentPage)
    }
  }, [pdfDoc, currentPage, extractPDFPagesUpTo])

  // Scroll to a specific page with offset
  const scrollToPageWithOffset = useCallback((pageNum: number, offsetPercent: number = 0) => {
    const container = scrollContainerRef.current
    if (!container) return false

    const pageEl = container.querySelector(`[data-page="${pageNum}"]`) as HTMLElement
    if (!pageEl) return false

    // Get canvas inside the page element
    const canvas = pageEl.querySelector('canvas')
    if (!canvas || canvas.height === 0) {
      // Canvas not rendered yet
      return false
    }

    // Use offsetTop which is relative to the scroll container
    const pageTop = pageEl.offsetTop
    const pageHeight = pageEl.offsetHeight
    const offset = pageHeight * offsetPercent

    container.scrollTop = pageTop + offset
    return true
  }, [])

  // Restore position after PDF loads
  useEffect(() => {
    if (!pdfDoc || !scrollContainerRef.current || progressLoading || positionRestoredRef.current) return

    // Get target position from localStorage or database
    const savedPosition = getSavedPosition()
    const progressData = progress as any

    const targetPage = savedPosition?.currentPage || progressData?.currentPage || 1
    const targetOffset = savedPosition?.pageOffsetPercent || progressData?.pageOffsetPercent || 0

    // First render pages around the target page
    const renderTargetPages = async () => {
      const container = scrollContainerRef.current
      if (!container) return

      // Render pages around target
      for (let i = Math.max(1, targetPage - 2); i <= Math.min(numPages, targetPage + 2); i++) {
        await renderPage(i, pdfDoc)
      }
    }

    // Try to restore position, with retries
    let retryCount = 0
    const maxRetries = 10

    const tryRestore = () => {
      const success = scrollToPageWithOffset(targetPage, targetOffset)
      if (success) {
        setCurrentPage(targetPage)
        positionRestoredRef.current = true
        lastScrollTopRef.current = scrollContainerRef.current?.scrollTop || 0
        
        // Re-render visible pages after restore
        setTimeout(renderVisiblePages, 100)
      } else if (retryCount < maxRetries) {
        retryCount++
        setTimeout(tryRestore, 100)
      } else {
        // Give up and just scroll to page
        const pageEl = scrollContainerRef.current?.querySelector(`[data-page="${targetPage}"]`)
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'instant' })
        }
        setCurrentPage(targetPage)
        positionRestoredRef.current = true
        lastScrollTopRef.current = scrollContainerRef.current?.scrollTop || 0
      }
    }

    // Start rendering, then try to restore
    renderTargetPages().then(() => {
      setTimeout(tryRestore, 50)
    })

  }, [pdfDoc, progressLoading, progress, numPages, renderPage, renderVisiblePages, getSavedPosition, scrollToPageWithOffset])

  // Calculate page offset percentage (how far into the current page we've scrolled)
  const calculatePageOffset = useCallback((pageNum: number): number => {
    const container = scrollContainerRef.current
    if (!container) return 0

    const pageEl = container.querySelector(`[data-page="${pageNum}"]`) as HTMLElement
    if (!pageEl) return 0

    const scrollTop = container.scrollTop
    const pageTop = pageEl.offsetTop
    const pageHeight = pageEl.offsetHeight

    // How far into this page are we?
    const offsetInPage = scrollTop - pageTop
    const offsetPercent = Math.max(0, Math.min(1, offsetInPage / pageHeight))

    return offsetPercent
  }, [])

  // Handle scroll events
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !pdfDoc) return

    const handleScroll = () => {
      renderVisiblePages()

      // Don't save until initial position is restored
      if (!positionRestoredRef.current) return

      // Debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      const scrollTop = container.scrollTop
      lastScrollTopRef.current = scrollTop

      saveTimeoutRef.current = setTimeout(() => {
        const maxScroll = container.scrollHeight - container.clientHeight
        const scrollPercentage = maxScroll > 0 ? scrollTop / maxScroll : 0
        const pageOffsetPercent = calculatePageOffset(currentPage)

        // Save precise position to localStorage (page + offset within page)
        savePosition(currentPage, pageOffsetPercent, scrollPercentage)

        // Also save to database via hook (including pageOffsetPercent for cross-device sync)
        updateProgress({
          currentPage,
          totalPages: numPages,
          percentage: (currentPage / numPages) * 100,
          scrollPercentage: Math.max(0, Math.min(1, scrollPercentage)),
          pageOffsetPercent,
        } as any)
      }, 300)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [pdfDoc, numPages, currentPage, renderVisiblePages, updateProgress, savePosition, calculatePageOffset])

  // Save progress immediately when leaving page
  useEffect(() => {
    const saveOnUnload = () => {
      if (!positionRestoredRef.current || !scrollContainerRef.current) return

      const container = scrollContainerRef.current
      const scrollTop = container.scrollTop
      const maxScroll = container.scrollHeight - container.clientHeight
      const scrollPercentage = maxScroll > 0 ? scrollTop / maxScroll : 0
      const pageOffsetPercent = calculatePageOffset(currentPage)

      // Save to localStorage synchronously
      const position: SavedPosition = {
        currentPage,
        pageOffsetPercent,
        scrollPercentage,
        timestamp: Date.now(),
      }
      localStorage.setItem(`book-${bookId}-position`, JSON.stringify(position))
    }

    window.addEventListener('beforeunload', saveOnUnload)
    return () => window.removeEventListener('beforeunload', saveOnUnload)
  }, [bookId, currentPage, calculatePageOffset])

  // Re-render on scale/rotation change
  useEffect(() => {
    if (!pdfDoc) return

    renderedPages.current.clear()
    renderingPages.current.clear()

    // Small delay to let canvases resize
    const timer = setTimeout(renderVisiblePages, 50)
    return () => clearTimeout(timer)
  }, [scale, rotation, pdfDoc, renderVisiblePages])

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault()
        setScale((s) => Math.min(s + 0.2, 4))
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        setScale((s) => Math.max(s - 0.2, 0.5))
      } else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        setRotation((r) => (r + 90) % 360)
      } else if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        toggleFullscreen()
      } else if (e.key === 'Home') {
        if (scrollMode === 'horizontal') {
          setCurrentPage(1)
        } else {
          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } else if (e.key === 'End') {
        if (scrollMode === 'horizontal') {
          setCurrentPage(numPages)
        } else {
          const container = scrollContainerRef.current
          if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
          }
        }
      } else if (scrollMode === 'horizontal') {
        // Page flip mode navigation with arrow keys
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
          e.preventDefault()
          if (currentPage < numPages) setCurrentPage(currentPage + 1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          if (currentPage > 1) setCurrentPage(currentPage - 1)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFullscreen, scrollMode, currentPage, numPages])

  // Go to specific page
  const goToPage = useCallback((page: number) => {
    if (scrollMode === 'horizontal') {
      // Page flip mode - just update current page
      const clampedPage = Math.max(1, Math.min(numPages, page))
      setCurrentPage(clampedPage)
    } else {
      // Vertical scroll mode - scroll to page
      const pageEl = scrollContainerRef.current?.querySelector(`[data-page="${page}"]`)
      pageEl?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [scrollMode, numPages])

  // Page flip navigation
  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1)
    }
  }, [currentPage, numPages])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }, [currentPage])

  if (loading || progressLoading) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border bg-destructive/10 p-6 text-center">
        <p className="font-semibold text-destructive">{errorMessage}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try going back to the library and opening the book again.
        </p>
        <Link href="/library" className="mt-4 inline-block">
          <Button>Back to Library</Button>
        </Link>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`flex h-[calc(100vh-120px)] flex-col rounded-lg border ${
        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-100 border-zinc-300'
      }`}
    >
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b p-2 ${
        isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'
      }`}>
        <div className="flex items-center gap-2">
          <Link href="/library">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          
          <span className="text-sm font-medium">
            Page {currentPage} of {numPages}
          </span>

          {/* Reading time indicator */}
          {showReadingTime && estimatedTimeLeft > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Clock className="h-3 w-3" />
              {estimatedTimeLeft < 60 
                ? `${estimatedTimeLeft} min left`
                : `${Math.floor(estimatedTimeLeft / 60)}h ${estimatedTimeLeft % 60}m left`
              }
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Navigation buttons for Page Flip mode */}
          {scrollMode === 'horizontal' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Page slider */}
          <div className="hidden sm:flex items-center gap-2 px-2">
            <Slider
              value={[currentPage]}
              min={1}
              max={numPages}
              step={1}
              onValueChange={([page]) => goToPage(page)}
              className="w-32"
            />
          </div>

          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))}
            title="Zoom out (Ctrl+-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale((s) => Math.min(s + 0.2, 4))}
            title="Zoom in (Ctrl+=)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          {/* TTS button */}
          <Button
            variant={showTTS ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowTTS(!showTTS)}
            title="Text-to-Speech"
          >
            <Volume2 className="h-4 w-4" />
          </Button>

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>View Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setScrollMode(scrollMode === 'vertical' ? 'horizontal' : 'vertical')}>
                {scrollMode === 'vertical' ? (
                  <>
                    <Columns className="mr-2 h-4 w-4" />
                    Page Flip
                  </>
                ) : (
                  <>
                    <AlignJustify className="mr-2 h-4 w-4" />
                    Vertical Scroll
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateCw className="mr-2 h-4 w-4" />
                Rotate (R)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <>
                    <Minimize className="mr-2 h-4 w-4" />
                    Exit Fullscreen
                  </>
                ) : (
                  <>
                    <Maximize className="mr-2 h-4 w-4" />
                    Fullscreen (F)
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* PDF Container */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className={`h-full overflow-auto ${
            scrollMode === 'horizontal' ? 'flex items-center justify-center' : 'p-4'
          }`}
          style={{
            scrollBehavior: 'auto',
          }}
        >
          {scrollMode === 'horizontal' ? (
            // Page Flip mode - show only current page with navigation
            <div className="flex items-center justify-center gap-2 w-full h-full px-2">
              {/* Previous page button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                title="Previous page (←)"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>

              {/* Current page canvas */}
              <div
                data-page={currentPage}
                className="flex justify-center items-center flex-1 overflow-auto py-2"
              >
                <canvas
                  ref={(el) => {
                    if (el) {
                      canvasRefs.current.set(currentPage, el)
                    }
                  }}
                  className={`shadow-lg ${isDark ? 'shadow-black/30' : 'shadow-zinc-400/30'}`}
                />
              </div>

              {/* Next page button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                title="Next page (→)"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </div>
          ) : (
            // Vertical scroll mode - show all pages
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                className="mb-4 flex justify-center"
              >
                <canvas
                  ref={(el) => {
                    if (el) {
                      canvasRefs.current.set(pageNum, el)
                    } else {
                      canvasRefs.current.delete(pageNum)
                    }
                  }}
                  className={`shadow-lg ${isDark ? 'shadow-black/30' : 'shadow-zinc-400/30'}`}
                  style={{
                    maxWidth: '100%',
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* TTS Panel */}
      {showTTS && (
        <div
          className={`sticky top-14 z-30 border-b p-4 shadow-sm ${
            isDark ? 'bg-zinc-900/95 border-zinc-700 backdrop-blur' : 'bg-white/95 border-zinc-200 backdrop-blur'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Text-to-Speech - Page {currentPage}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTTS(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <TextToSpeech
            text={currentPageText || 'Loading text...'}
            theme={isDark ? 'dark' : 'light'}
          />
        </div>
      )}

      {/* Bottom progress bar */}
      <div className={`h-1 ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`}>
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentPage / numPages) * 100}%` }}
        />
      </div>

      {/* AI Assistant */}
      <AIAssistant
        bookId={bookId}
        bookTitle={bookTitle || 'Book'}
        bookAuthor={bookAuthor}
        theme={isDark ? 'dark' : 'light'}
        position={currentPage}
      />

      {/* Text Selection Popup for Copy */}
      <CopyPopup theme={isDark ? 'dark' : 'light'} />
    </div>
  )
}
