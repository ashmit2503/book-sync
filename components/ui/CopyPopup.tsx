'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

interface CopyPopupProps {
  theme?: 'light' | 'dark'
}

interface SelectionData {
  text: string
  rect: DOMRect
}

export function CopyPopup({ theme = 'light' }: CopyPopupProps) {
  const [selection, setSelection] = useState<SelectionData | null>(null)
  const [copied, setCopied] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const iframeListenersRef = useRef<Map<Window, () => void>>(new Map())

  const isDark = theme === 'dark'

  // Handle text selection from any window (main or iframe)
  const handleSelectionChange = useCallback((targetWindow: Window = window) => {
    const sel = targetWindow.getSelection()
    
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      return
    }

    const text = sel.toString().trim()
    if (text.length < 2) return

    let range: Range
    try {
      range = sel.getRangeAt(0)
    } catch {
      return
    }
    
    let rect = range.getBoundingClientRect()

    // Check if rect is valid
    if (rect.width === 0 && rect.height === 0) {
      return
    }

    // If selection is from an iframe, adjust the rect position
    if (targetWindow !== window) {
      const iframes = document.querySelectorAll('iframe')
      for (const iframe of iframes) {
        if (iframe.contentWindow === targetWindow) {
          const iframeRect = iframe.getBoundingClientRect()
          rect = new DOMRect(
            rect.x + iframeRect.x,
            rect.y + iframeRect.y,
            rect.width,
            rect.height
          )
          break
        }
      }
    }

    setSelection({ text, rect })
    setCopied(false)
  }, [])

  // Set up listeners for iframes (EPUB content is rendered in iframes)
  const setupIframeListeners = useCallback(() => {
    const iframes = document.querySelectorAll('iframe')
    
    iframes.forEach((iframe) => {
      try {
        const iframeWindow = iframe.contentWindow
        const iframeDoc = iframe.contentDocument || iframeWindow?.document
        
        if (iframeWindow && iframeDoc && !iframeListenersRef.current.has(iframeWindow)) {
          if (iframeDoc.body && iframeDoc.body.innerHTML) {
            const handler = () => {
              setTimeout(() => handleSelectionChange(iframeWindow), 10)
            }
            iframeDoc.addEventListener('mouseup', handler)
            iframeDoc.addEventListener('touchend', handler)
            iframeListenersRef.current.set(iframeWindow, handler)
          }
        }
      } catch (e) {
        // Cross-origin iframe, can't access
      }
    })
  }, [handleSelectionChange])

  // Listen for selection changes
  useEffect(() => {
    const mainHandler = () => handleSelectionChange(window)
    document.addEventListener('mouseup', mainHandler)
    document.addEventListener('touchend', mainHandler)

    setupIframeListeners()

    const intervalId = setInterval(setupIframeListeners, 500)
    
    const observer = new MutationObserver(() => {
      setupIframeListeners()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    
    return () => {
      document.removeEventListener('mouseup', mainHandler)
      document.removeEventListener('touchend', mainHandler)
      clearInterval(intervalId)
      observer.disconnect()
      
      iframeListenersRef.current.forEach((handler, iframeWindow) => {
        try {
          const iframeDoc = (iframeWindow as Window).document
          if (iframeDoc) {
            iframeDoc.removeEventListener('mouseup', handler)
            iframeDoc.removeEventListener('touchend', handler)
          }
        } catch (e) {
          // iframe may have been removed
        }
      })
      iframeListenersRef.current.clear()
    }
  }, [handleSelectionChange, setupIframeListeners])

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setTimeout(() => {
          const sel = window.getSelection()
          if (!sel || sel.isCollapsed) {
            setSelection(null)
          }
        }, 100)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle copy text
  const handleCopy = () => {
    if (selection) {
      navigator.clipboard.writeText(selection.text)
      setCopied(true)
      setTimeout(() => {
        setSelection(null)
        setCopied(false)
      }, 1000)
    }
  }

  if (!selection) return null

  const popupWidth = 100
  const popupHeight = 40
  
  const left = Math.max(10, Math.min(
    selection.rect.left + selection.rect.width / 2 - popupWidth / 2,
    window.innerWidth - popupWidth - 10
  ))
  
  const top = selection.rect.top - popupHeight - 10 > 10
    ? selection.rect.top - popupHeight - 10
    : selection.rect.bottom + 10

  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left,
    top,
    zIndex: 9999,
  }

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className={`rounded-lg shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center p-1">
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1.5 ${
            isDark 
              ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' 
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
          onClick={handleCopy}
          title="Copy selected text"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span className="text-xs font-medium">Copy</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
