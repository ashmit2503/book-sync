'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import ePub, { Book, Rendition } from 'epubjs'
import { useReadingProgress } from '@/lib/hooks/useReadingProgress'
import { useTextExtraction } from '@/lib/hooks/useTextExtraction'
import { useReadingSession } from '@/lib/hooks/useReadingSession'
import { useUserPreferences } from '@/lib/hooks/useUserPreferences'
import { useTheme } from '@/components/providers/ThemeProvider'
import { getCachedEPUB, cacheEPUB } from '@/lib/utils/epubCache'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { AIAssistant } from '@/components/ai/AIAssistant'
import { CopyPopup } from '@/components/ui/CopyPopup'
import { TextToSpeech } from '@/components/readers/TextToSpeech'
import {
  Loader2,
  Maximize,
  Minimize,
  Columns,
  AlignJustify,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Settings2,
  List,
  X,
  Volume2,
  Clock,
  ChevronLeft,
  ChevronRight,
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

interface EPUBReaderProps {
  bookId: string
  fileUrl: string
  bookTitle?: string
  bookAuthor?: string
}

type ScrollMode = 'vertical' | 'horizontal'

interface TocItem {
  label: string
  href: string
}

// Font family mapping
const fontFamilyMap: Record<string, string> = {
  'default': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  'serif': 'Georgia, "Times New Roman", Times, serif',
  'sans-serif': 'Arial, Helvetica, sans-serif',
  'georgia': 'Georgia, "Times New Roman", Times, serif',
  'verdana': 'Verdana, Geneva, Tahoma, sans-serif',
  'opendyslexic': '"OpenDyslexic", "Comic Sans MS", cursive, sans-serif',
}

// Margins mapping (in pixels for epubjs)
const marginsMap: Record<string, string> = {
  'narrow': '16px',
  'normal': '32px',
  'wide': '64px',
}

// Average reading speed (words per minute)
const AVERAGE_WPM = 250

export function EPUBReader({ bookId, fileUrl, bookTitle, bookAuthor }: EPUBReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const ttsExtractTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const epubDataRef = useRef<ArrayBuffer | null>(null)

  // User preferences
  const { preferences, isLoading: preferencesLoading } = useUserPreferences()

  const [signedUrl, setSignedUrl] = useState(fileUrl)
  const [hasRetried, setHasRetried] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Loading EPUB...')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentPercentage, setCurrentPercentage] = useState(0)
  const [currentLocation, setCurrentLocation] = useState('')
  const [fontSize, setFontSize] = useState(100)
  const [fontFamily, setFontFamily] = useState('default')
  const [lineSpacing, setLineSpacing] = useState(1.5)
  const [margins, setMargins] = useState<'narrow' | 'normal' | 'wide'>('normal')
  const [scrollMode, setScrollMode] = useState<ScrollMode>('vertical')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showToc, setShowToc] = useState(false)
  const [showTTS, setShowTTS] = useState(false)
  const [showReadingTime, setShowReadingTime] = useState(true)
  const [currentChapterText, setCurrentChapterText] = useState('')
  const [toc, setToc] = useState<TocItem[]>([])
  const [totalLocations, setTotalLocations] = useState(100)
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(0) // in minutes
  const [preferencesApplied, setPreferencesApplied] = useState(false)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Apply user preferences on load
  useEffect(() => {
    if (!preferencesLoading && preferences && !preferencesApplied) {
      setFontSize(preferences.font_size)
      setFontFamily(preferences.font_family)
      setLineSpacing(preferences.line_spacing)
      setMargins(preferences.margins)
      setScrollMode(preferences.scroll_mode)
      setShowReadingTime(preferences.show_reading_time)
      // Enable TTS panel if user has it enabled
      if (preferences.enable_tts) {
        setShowTTS(true)
      }
      setPreferencesApplied(true)
    }
  }, [preferencesLoading, preferences, preferencesApplied])

  // Track when component is mounted (ref is available)
  useEffect(() => {
    setMounted(true)
  }, [])

  const { progress, updateProgress, isLoading: progressLoading } = useReadingProgress(bookId)

  // Reading session tracking
  const { startSession, endSession } = useReadingSession({ bookId })

  // Start session when component mounts, end when unmounts
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
    extractEPUBText,
    resetExtraction,
  } = useTextExtraction({ bookId, bookType: 'epub' })

  // Initialize context on mount
  useEffect(() => {
    initializeContext()
    return () => {
      resetExtraction()
    }
  }, [initializeContext, resetExtraction])

  // Extract text for TTS that matches the *visible* portion of the EPUB
  const extractCurrentChapterText = useCallback(async () => {
    if (!renditionRef.current) return

    try {
      const contents = renditionRef.current.getContents() as any
      if (!contents || !Array.isArray(contents) || contents.length === 0) return

      let visibleText = ''

      for (const content of contents) {
        const doc = content.document as Document | null
        const win = content.window as Window | undefined
        if (!doc || !doc.body || !win) continue

        const viewportHeight = win.innerHeight || doc.documentElement.clientHeight || 0
        if (!viewportHeight) continue

        // Get all text-containing elements
        const allElements = Array.from(doc.body.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, span, a'))
        
        // Find elements that are currently visible - prioritize those near the top
        const visibleElements = allElements
          .map(el => {
            const rect = (el as HTMLElement).getBoundingClientRect()
            return {
              element: el as HTMLElement,
              rect,
              // Score: lower is better (closer to top of viewport)
              score: rect.top >= 0 ? rect.top : 10000
            }
          })
          .filter(item => {
            // Must be in viewport with top edge visible
            return item.rect.top >= 0 && item.rect.top < viewportHeight && item.rect.bottom > item.rect.top
          })
          .sort((a, b) => a.score - b.score) // Sort by closest to viewport top
        
        // Take text from elements starting from the topmost visible one
        for (const item of visibleElements) {
          const text = item.element.innerText || item.element.textContent || ''
          const cleaned = text.trim()
          if (cleaned && cleaned.length > 3) { // Skip very short fragments
            visibleText += cleaned + '\n'
          }
        }
      }

      const cleaned = visibleText.trim()
      if (cleaned && cleaned.length > 10) {
        setCurrentChapterText(cleaned)
        return
      }

      // Fallback: use full chapter text from the first content if viewport detection fails
      const first = (renditionRef.current.getContents() as any)[0]
      const doc = first?.document as Document | null
      if (doc?.body) {
        const fallback = doc.body.innerText || doc.body.textContent || ''
        setCurrentChapterText(fallback)
      }
    } catch (error) {
      console.warn('[EPUBReader] Failed to extract visible chapter text for TTS:', error)
    }
  }, [])

  // Apply styles to EPUB rendition - this function properly injects CSS
  const applyEpubStyles = useCallback((rendition: Rendition) => {
    const bgColor = isDark ? '#18181b' : '#ffffff'
    const textColor = isDark ? '#e4e4e7' : '#1a1a1a'
    const fontFam = fontFamilyMap[fontFamily] || fontFamilyMap['default']
    const marginSize = marginsMap[margins]
    
    // Register a theme with all styles
    rendition.themes.register('custom', {
      'body': {
        'background-color': `${bgColor} !important`,
        'color': `${textColor} !important`,
        'font-family': `${fontFam} !important`,
        'line-height': `${lineSpacing} !important`,
        'padding-left': `${marginSize} !important`,
        'padding-right': `${marginSize} !important`,
      },
      'p, div, span, h1, h2, h3, h4, h5, h6, li, blockquote': {
        'font-family': `${fontFam} !important`,
        'line-height': `${lineSpacing} !important`,
        'color': `${textColor} !important`,
      },
      'a': {
        'color': isDark ? '#60a5fa !important' : '#2563eb !important',
      }
    })
    
    // Select and apply the theme
    rendition.themes.select('custom')
    
    // Apply font size
    rendition.themes.fontSize(`${fontSize}%`)
  }, [isDark, fontFamily, lineSpacing, margins, fontSize])

  // Apply theme changes to EPUB rendition when settings change
  useEffect(() => {
    if (renditionRef.current && !loading) {
      applyEpubStyles(renditionRef.current)
    }
    if (viewerRef.current) {
      viewerRef.current.style.backgroundColor = isDark ? '#18181b' : '#ffffff'
    }
  }, [isDark, fontSize, fontFamily, lineSpacing, margins, applyEpubStyles, loading])

  // Initialize EPUB
  useEffect(() => {
    if (!mounted || !signedUrl || progressLoading || !preferencesApplied) return
    if (!viewerRef.current) {
      return
    }

    let cancelled = false

    async function initEPUB() {
      try {
        setLoading(true)
        setLoadingMessage('Checking cache...')

        let epubData: ArrayBuffer
        
        // Use cached data if already loaded, otherwise fetch
        if (epubDataRef.current) {
          epubData = epubDataRef.current
        } else {
          const cachedData = await getCachedEPUB(bookId)

          if (cachedData) {
            setLoadingMessage('Loading from cache...')
            epubData = cachedData
          } else {
            setLoadingMessage('Downloading EPUB...')
            const response = await fetch(signedUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch EPUB: ${response.status} ${response.statusText}`)
            }
            epubData = await response.arrayBuffer()

            setLoadingMessage('Caching for offline use...')
            try {
              await cacheEPUB(bookId, epubData)
            } catch (cacheError) {
              console.warn('[EPUBReader] Failed to cache:', cacheError)
            }
          }
          
          // Store for reuse when scroll mode changes
          epubDataRef.current = epubData
        }

        if (cancelled) return

        setLoadingMessage('Parsing EPUB...')
        const book = ePub(epubData as any)
        bookRef.current = book

        await book.ready

        if (cancelled) return

        // Get table of contents
        setLoadingMessage('Loading contents...')
        const navigation = await book.loaded.navigation
        if (navigation.toc) {
          const items: TocItem[] = navigation.toc.map((item: any) => ({
            label: item.label,
            href: item.href,
          }))
          setToc(items)
        }

        if (cancelled) return

        setLoadingMessage('Rendering...')
        
        // Configure rendition based on scroll mode
        const isHorizontal = scrollMode === 'horizontal'
        const rendition = book.renderTo(viewerRef.current!, {
          width: '100%',
          height: '100%',
          spread: isHorizontal ? 'auto' : 'none',
          flow: isHorizontal ? 'paginated' : 'scrolled',
          manager: isHorizontal ? 'default' : 'continuous',
        })
        renditionRef.current = rendition

        // Apply styles
        applyEpubStyles(rendition)

        // Load saved location
        let savedLocation: string | undefined
        try {
          const localSaved = localStorage.getItem(`book-${bookId}-epub-location`)
          if (localSaved) {
            savedLocation = localSaved
          }
        } catch (e) {
          console.error('Failed to read localStorage:', e)
        }
        
        if (!savedLocation) {
          const savedProgress = progress as any
          savedLocation = savedProgress?.location
        }

        await rendition.display(savedLocation || undefined)

        if (cancelled) return

        // Generate locations for progress tracking and reading time
        await book.locations.generate(1600)
        const totalLocs = book.locations.length()
        setTotalLocations(totalLocs)
        
        // Estimate total reading time (rough estimate: 1600 chars per location, ~250 words)
        // Each location is roughly 1600 characters, average word is 5 chars
        const estimatedWords = (totalLocs * 1600) / 5
        const totalMinutes = Math.ceil(estimatedWords / AVERAGE_WPM)
        setEstimatedTimeLeft(totalMinutes) // Initialize with total time

        // Track location changes
        rendition.on('relocated', (location: any) => {
          if (cancelled) return

          const cfi = location.start.cfi
          setCurrentLocation(cfi)

          try {
            localStorage.setItem(`book-${bookId}-epub-location`, cfi)
          } catch (e) {
            console.error('Failed to save to localStorage:', e)
          }

          if (book.locations) {
            const percentage = book.locations.percentageFromCfi(cfi)
            const locIndex = Math.round(percentage * book.locations.length())
            setCurrentPercentage(percentage * 100)
            setCurrentLocationIndex(locIndex)
            
            // Calculate remaining reading time
            const remainingPercent = 1 - percentage
            const remainingMinutes = Math.ceil(totalMinutes * remainingPercent)
            setEstimatedTimeLeft(remainingMinutes)

            // Extract text for AI assistant
            extractEPUBText(book, rendition, percentage)

            // Extract text for TTS (debounced to avoid too frequent updates)
            if (ttsExtractTimeoutRef.current) {
              clearTimeout(ttsExtractTimeoutRef.current)
            }
            ttsExtractTimeoutRef.current = setTimeout(() => {
              extractCurrentChapterText()
            }, 150)

            // Debounced save to database
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current)
            }

            saveTimeoutRef.current = setTimeout(() => {
              updateProgress({
                currentPage: locIndex,
                totalPages: book.locations.length(),
                percentage: percentage * 100,
                location: cfi,
              } as any)
            }, 500)
          }
        })

        // Add scroll listener to EPUB content iframes to keep TTS synced with visible content
        rendition.on('rendered', () => {
          const contents = rendition.getContents() as any
          if (contents && Array.isArray(contents)) {
            for (const content of contents) {
              const win = content.window as Window | undefined
              if (win) {
                win.addEventListener('scroll', () => {
                  if (ttsExtractTimeoutRef.current) {
                    clearTimeout(ttsExtractTimeoutRef.current)
                  }
                  ttsExtractTimeoutRef.current = setTimeout(() => {
                    extractCurrentChapterText()
                  }, 200)
                }, { passive: true })
              }
            }
          }
        })

        setLoading(false)
      } catch (error) {
        if (cancelled) return
        console.error('[EPUBReader] Error loading EPUB:', error)
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        setErrorMessage(`Unable to load EPUB: ${errorMsg}`)
        setLoading(false)
      }
    }

    initEPUB()

    return () => {
      cancelled = true
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (ttsExtractTimeoutRef.current) {
        clearTimeout(ttsExtractTimeoutRef.current)
      }
      if (renditionRef.current) {
        renditionRef.current.destroy()
      }
      if (bookRef.current) {
        bookRef.current.destroy()
      }
    }
  // Note: applyEpubStyles is intentionally excluded - styles are applied separately
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedUrl, progressLoading, mounted, preferencesApplied, bookId])

  // Track previous scroll mode to detect changes
  const prevScrollModeRef = useRef<ScrollMode>(scrollMode)

  // Handle scroll mode changes - requires re-creating rendition
  useEffect(() => {
    if (prevScrollModeRef.current === scrollMode) return
    prevScrollModeRef.current = scrollMode
    
    if (!bookRef.current || !viewerRef.current || loading) return
    
    const book = bookRef.current
    const savedLocation = currentLocation
    
    // Destroy current rendition
    if (renditionRef.current) {
      renditionRef.current.destroy()
      renditionRef.current = null
    }
    
    // Clear the viewer
    if (viewerRef.current) {
      viewerRef.current.innerHTML = ''
    }
    
    // Create new rendition with new scroll mode
    const isHorizontal = scrollMode === 'horizontal'
    const rendition = book.renderTo(viewerRef.current!, {
      width: '100%',
      height: '100%',
      spread: isHorizontal ? 'auto' : 'none',
      flow: isHorizontal ? 'paginated' : 'scrolled',
      manager: isHorizontal ? 'default' : 'continuous',
    })
    renditionRef.current = rendition
    
    // Apply styles
    applyEpubStyles(rendition)
    
    // Navigate to saved location
    rendition.display(savedLocation || undefined)
  }, [scrollMode, loading, currentLocation, applyEpubStyles])

  // Apply font size changes (acts like zoom)
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`)
    }
  }, [fontSize])

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

  // Navigation
  const goToLocation = useCallback((href: string) => {
    renditionRef.current?.display(href)
    setShowToc(false)
  }, [])

  const goToLocationIndex = useCallback((index: number) => {
    if (bookRef.current?.locations && totalLocations > 0) {
      const percent = index / totalLocations
      const cfi = bookRef.current.locations.cfiFromPercentage(percent)
      renditionRef.current?.display(cfi)
    }
  }, [totalLocations])

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      if (e.key === 'f') {
        toggleFullscreen()
      }
      
      // Arrow key navigation for horizontal mode
      if (scrollMode === 'horizontal' && renditionRef.current) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          renditionRef.current.prev()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          renditionRef.current.next()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFullscreen, scrollMode])

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
      className={`relative flex h-[calc(100vh-120px)] flex-col rounded-lg border ${
        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-100 border-zinc-300'
      }`}
    >
      {/* Loading overlay - keep viewer in DOM so ref is available */}
      {(loading || progressLoading) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{loadingMessage}</p>
          </div>
        </div>
      )}
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
            Section {currentLocationIndex} of {totalLocations}
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
          {/* Navigation buttons for horizontal mode */}
          {scrollMode === 'horizontal' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => renditionRef.current?.prev()}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => renditionRef.current?.next()}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {/* Progress slider */}
          <div className="hidden sm:flex items-center gap-2 px-2">
            <Slider
              value={[currentLocationIndex]}
              min={0}
              max={totalLocations}
              step={1}
              onValueChange={([value]) => goToLocationIndex(value)}
              className="w-32"
            />
          </div>

          {/* Zoom controls (font size) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFontSize((s) => Math.max(s - 10, 70))}
            title="Decrease font size"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs">{fontSize}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFontSize((s) => Math.min(s + 10, 200))}
            title="Increase font size"
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
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Reading Mode</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setScrollMode('vertical')}
                className={scrollMode === 'vertical' ? 'bg-accent' : ''}
              >
                <AlignJustify className="mr-2 h-4 w-4" />
                Vertical Scroll
                {scrollMode === 'vertical' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setScrollMode('horizontal')}
                className={scrollMode === 'horizontal' ? 'bg-accent' : ''}
              >
                <Columns className="mr-2 h-4 w-4" />
                Page Flip
                {scrollMode === 'horizontal' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowToc(!showToc)}>
                <List className="mr-2 h-4 w-4" />
                Table of Contents
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

      {/* EPUB Container */}
      <div className="relative flex-1 overflow-hidden">
        {/* Table of Contents sidebar */}
        {showToc && (
          <div className={`absolute left-0 top-0 h-full w-72 z-10 overflow-y-auto border-r shadow-lg ${
            isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'
          }`}>
            <div className={`sticky top-0 flex items-center justify-between p-3 border-b ${
              isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'
            }`}>
              <span className="font-semibold">Contents</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowToc(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-2">
              {toc.map((item, index) => (
                <button
                  key={index}
                  onClick={() => goToLocation(item.href)}
                  className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-primary/10 ${
                    isDark ? 'text-zinc-300 hover:text-white' : ''
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EPUB viewer */}
        <div
          ref={viewerRef}
          className="h-full w-full overflow-auto p-4"
          style={{ backgroundColor: isDark ? '#18181b' : '#ffffff' }}
        />
      </div>

      {/* TTS Panel */}
      {showTTS && (
        <div
          className={`sticky top-14 z-30 border-b p-4 shadow-sm ${
            isDark ? 'bg-zinc-900/95 border-zinc-700 backdrop-blur' : 'bg-white/95 border-zinc-200 backdrop-blur'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Text-to-Speech</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTTS(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <TextToSpeech
            text={currentChapterText || 'Loading text...'}
            theme={isDark ? 'dark' : 'light'}
          />
        </div>
      )}

      {/* Bottom progress bar */}
      <div className={`h-1 ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`}>
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${currentPercentage}%` }}
        />
      </div>

      {/* AI Assistant */}
      <AIAssistant
        bookId={bookId}
        bookTitle={bookTitle || 'Book'}
        bookAuthor={bookAuthor}
        theme={isDark ? 'dark' : 'light'}
        position={Math.floor(currentPercentage)}
      />

      {/* Copy Popup for text selection */}
      <CopyPopup theme={isDark ? 'dark' : 'light'} />
    </div>
  )
}
