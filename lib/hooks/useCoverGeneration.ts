'use client'

import { useEffect, useState, useCallback } from 'react'
import { generatePDFCover } from '@/lib/utils/generateCover'

export function useCoverGeneration(bookId: string, fileType: string, hasCover: boolean, userId: string) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  const doGenerate = useCallback(async () => {
    setIsGenerating(true)

    try {
      const res = await fetch(`/api/books/${bookId}/generate-cover`, {
        method: 'POST',
      })

      if (!res.ok) {
        return null
      }

      const data = await res.json()

      if (data.cached) {
        setCoverUrl(data.coverUrl)
        return data.coverUrl
      } else if (data.needsGeneration && data.pdfUrl) {
        const url = await generatePDFCover(bookId, data.pdfUrl, userId)
        if (url) {
          setCoverUrl(url)
        }
        return url
      }
      return null
    } catch {
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [bookId, userId])

  const regenerate = useCallback(async () => {
    return doGenerate()
  }, [doGenerate])

  useEffect(() => {
    if (hasCover || fileType !== 'pdf' || isGenerating || coverUrl) {
      return
    }

    let cancelled = false

    const timer = setTimeout(() => {
      if (!cancelled) {
        doGenerate()
      }
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [bookId, fileType, hasCover, isGenerating, coverUrl, doGenerate])

  return { coverUrl, isGenerating, regenerate }
}
