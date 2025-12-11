import { createClient } from '@/lib/supabase/client'

/**
 * Validates an ebook file for upload
 */
export function validateEbookFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 500 * 1024 * 1024 // 500MB

  // Check by file extension first (more reliable than MIME type)
  const fileName = file.name.toLowerCase()
  const isValidExtension = fileName.endsWith('.pdf') || fileName.endsWith('.epub')

  if (!isValidExtension) {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF and EPUB files are supported.',
    }
  }

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 500MB.',
    }
  }

  return { valid: true }
}

/**
 * Deletes a book and its associated storage files
 */
export async function deleteBook(bookId: string): Promise<void> {
  const supabase = createClient()

  // Get book details first
  const { data: book, error: fetchError } = await supabase
    .from('books')
    .select('file_path, cover_url')
    .eq('id', bookId)
    .single()

  if (fetchError || !book) {
    // If book doesn't exist, consider it already deleted
    if (fetchError?.code === 'PGRST116') {
      return
    }
    throw new Error('Book not found')
  }

  // Delete from database first (this will cascade to related tables)
  const { error: dbError } = await supabase
    .from('books')
    .delete()
    .eq('id', bookId)

  if (dbError) {
    throw new Error(`Failed to delete book: ${dbError.message}`)
  }

  // Delete storage files (best effort)
  const storageDeletes: Promise<any>[] = []

  if (book.file_path) {
    storageDeletes.push(
      supabase.storage
        .from('ebooks')
        .remove([book.file_path])
        .catch(() => {})
    )
  }

  if (book.cover_url && book.cover_url.includes('/covers/')) {
    const coverPath = book.cover_url.split('/covers/').pop()
    if (coverPath) {
      storageDeletes.push(
        supabase.storage
          .from('covers')
          .remove([coverPath])
          .catch(() => {})
      )
    }
  }

  await Promise.allSettled(storageDeletes)
}
