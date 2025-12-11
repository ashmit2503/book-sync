import * as pdfjsLib from 'pdfjs-dist'
import ePub from 'epubjs'
import { createClient } from '@/lib/supabase/client'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

/**
 * Generate cover from a File object (used during upload).
 * Supports PDF and EPUB files.
 */
export async function generateCoverFromFile(
  bookId: string,
  file: File,
  userId: string
): Promise<string | null> {
  const fileName = file.name.toLowerCase()
  const isPDF = fileName.endsWith('.pdf')
  const isEPUB = fileName.endsWith('.epub')
  
  if (!isPDF && !isEPUB) {
    return null
  }
  
  try {
    const fileData = await file.arrayBuffer()
    
    if (isPDF) {
      return await generateCoverFromPDFData(bookId, fileData, userId)
    } else {
      return await generateCoverFromEPUBData(bookId, fileData, userId)
    }
  } catch {
    return null
  }
}

/**
 * Generate cover from PDF ArrayBuffer data
 */
async function generateCoverFromPDFData(
  bookId: string,
  pdfData: ArrayBuffer,
  userId: string
): Promise<string | null> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData })
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)

    const scale = 2
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get canvas context')
    }

    await page.render({
      canvasContext: context,
      viewport,
    }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error('Failed to create blob'))
      }, 'image/jpeg', 0.85)
    })

    const supabase = createClient()
    const coverPath = `${userId}/${bookId}/cover.jpg`

    let { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(coverPath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    let bucketUsed = 'covers'
    
    if (uploadError) {
      const fallbackResult = await supabase.storage
        .from('ebooks')
        .upload(coverPath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      
      if (fallbackResult.error) {
        throw new Error(`Failed to upload cover: ${uploadError.message}`)
      }
      
      bucketUsed = 'ebooks'
    }

    let coverUrl: string
    if (bucketUsed === 'covers') {
      const { data: urlData } = supabase.storage
        .from('covers')
        .getPublicUrl(coverPath)
      coverUrl = urlData?.publicUrl || ''
    } else {
      const { data: urlData } = await supabase.storage
        .from('ebooks')
        .createSignedUrl(coverPath, 60 * 60 * 24 * 365)
      coverUrl = urlData?.signedUrl || ''
    }

    if (!coverUrl) {
      throw new Error('Failed to get cover URL')
    }

    await supabase
      .from('books')
      .update({ cover_url: coverUrl })
      .eq('id', bookId)

    return coverUrl
  } catch {
    return null
  }
}

/**
 * Generate cover from EPUB ArrayBuffer data
 */
async function generateCoverFromEPUBData(
  bookId: string,
  epubData: ArrayBuffer,
  userId: string
): Promise<string | null> {
  try {
    const book = ePub(epubData as any)
    await book.ready
    
    const coverUrl = await book.coverUrl()
    
    if (!coverUrl) {
      book.destroy()
      return null
    }
    
    const response = await fetch(coverUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch EPUB cover image')
    }
    
    const blob = await response.blob()
    
    const supabase = createClient()
    const coverPath = `${userId}/${bookId}/cover.jpg`
    
    let { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(coverPath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    let bucketUsed = 'covers'
    
    if (uploadError) {
      const fallbackResult = await supabase.storage
        .from('ebooks')
        .upload(coverPath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      
      if (fallbackResult.error) {
        throw new Error(`Failed to upload cover: ${uploadError.message}`)
      }
      
      bucketUsed = 'ebooks'
    }

    let finalCoverUrl: string
    if (bucketUsed === 'covers') {
      const { data: urlData } = supabase.storage
        .from('covers')
        .getPublicUrl(coverPath)
      finalCoverUrl = urlData?.publicUrl || ''
    } else {
      const { data: urlData } = await supabase.storage
        .from('ebooks')
        .createSignedUrl(coverPath, 60 * 60 * 24 * 365)
      finalCoverUrl = urlData?.signedUrl || ''
    }
    
    if (!finalCoverUrl) {
      throw new Error('Failed to get cover URL')
    }

    await supabase
      .from('books')
      .update({ cover_url: finalCoverUrl })
      .eq('id', bookId)

    book.destroy()
    return finalCoverUrl
  } catch {
    return null
  }
}

/**
 * Generate cover from PDF URL
 */
export async function generatePDFCover(
  bookId: string,
  pdfUrl: string,
  userId: string
): Promise<string | null> {
  try {
    const response = await fetch(pdfUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`)
    }
    const pdfData = await response.arrayBuffer()
    
    return await generateCoverFromPDFData(bookId, pdfData, userId)
  } catch {
    return null
  }
}
