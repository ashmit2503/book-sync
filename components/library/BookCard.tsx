'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { BookOpen, Trash2, MoreVertical, ImageIcon, Edit2, FolderPlus, Check, X } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteBook } from '@/lib/utils/upload'
import { useRouter } from 'next/navigation'
import { useCoverGeneration } from '@/lib/hooks/useCoverGeneration'
import { useCollections } from '@/lib/hooks/useLibrary'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

type Book = Database['public']['Tables']['books']['Row']

interface BookCardProps {
  book: Book
  onUpdate?: () => void
}

export function BookCard({ book, onUpdate }: BookCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [regeneratingCover, setRegeneratingCover] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newTitle, setNewTitle] = useState(book.title)
  const [bookCollections, setBookCollections] = useState<string[]>([])
  const router = useRouter()
  
  const { collections, addBookToCollection, removeBookFromCollection, getCollectionsForBook } = useCollections()
  
  // Auto-generate cover if missing
  const { coverUrl: generatedCover, regenerate } = useCoverGeneration(
    book.id,
    book.file_type,
    !!book.cover_url,
    book.user_id
  )

  const displayCover = book.cover_url || generatedCover

  const readingProgress = book.reading_progress as { percentage?: number }
  const progress = readingProgress?.percentage || 0

  // Load book's collections
  useEffect(() => {
    async function loadBookCollections() {
      const collIds = await getCollectionsForBook(book.id)
      setBookCollections(collIds)
    }
    loadBookCollections()
  }, [book.id, getCollectionsForBook])

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this book?')) {
      return
    }

    setDeleting(true)
    
    // Call onUpdate immediately for optimistic UI update
    onUpdate?.()
    
    try {
      await deleteBook(book.id)
      // No need to call router.refresh() - optimistic update already removed it from UI
    } catch (error) {
      console.error('Failed to delete book:', error)
      alert('Failed to delete book. Please try again.')
      setDeleting(false)
      // Refresh to restore the book if deletion failed
      router.refresh()
    }
  }

  async function handleRegenerateCover() {
    if (book.file_type !== 'pdf') {
      alert('Cover generation is only supported for PDF files')
      return
    }
    
    setRegeneratingCover(true)
    try {
      await regenerate()
      router.refresh()
    } catch (error) {
      console.error('Failed to regenerate cover:', error)
      alert('Failed to regenerate cover')
    } finally {
      setRegeneratingCover(false)
    }
  }

  async function handleRename() {
    if (!newTitle.trim() || newTitle === book.title) {
      setIsRenaming(false)
      setNewTitle(book.title)
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('books')
      .update({ title: newTitle.trim() })
      .eq('id', book.id)

    if (error) {
      console.error('Failed to rename book:', error)
      alert('Failed to rename book')
      setNewTitle(book.title)
    } else {
      router.refresh()
      onUpdate?.()
    }
    setIsRenaming(false)
  }

  async function handleToggleCollection(collectionId: string) {
    const isInCollection = bookCollections.includes(collectionId)
    
    if (isInCollection) {
      const success = await removeBookFromCollection(collectionId, book.id)
      if (success) {
        setBookCollections(prev => prev.filter(id => id !== collectionId))
      }
    } else {
      const success = await addBookToCollection(collectionId, book.id)
      if (success) {
        setBookCollections(prev => [...prev, collectionId])
      }
    }
  }

  const isPending = book.processing_status === 'pending' || book.processing_status === 'processing'

  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      <Link href={isPending ? '#' : `/library/${book.id}/read`}>
        <CardContent className="p-0">
          <div className="relative aspect-[2/3] overflow-hidden bg-muted">
            {displayCover ? (
              <Image
                src={displayCover}
                alt={book.title}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="200px"
                priority={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                <div className="text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-2 px-2 text-xs font-semibold text-muted-foreground line-clamp-2">
                    {book.title}
                  </p>
                </div>
              </div>
            )}
            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="text-center">
                  <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm font-medium">Processing...</p>
                </div>
              </div>
            )}
            {progress > 0 && !isPending && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/50">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Link>
      
      <CardFooter className="flex flex-col items-start gap-2 p-4">
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename()
                    if (e.key === 'Escape') {
                      setIsRenaming(false)
                      setNewTitle(book.title)
                    }
                  }}
                  autoFocus
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRename}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                  setIsRenaming(false)
                  setNewTitle(book.title)
                }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Link href={isPending ? '#' : `/library/${book.id}/read`}>
                <h3 className="truncate font-semibold leading-tight hover:text-primary">
                  {book.title}
                </h3>
              </Link>
            )}
            {book.author && !isRenaming && (
              <p className="truncate text-sm text-muted-foreground">
                {book.author}
              </p>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={deleting}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              
              {collections.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Add to Collection
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {collections.map((collection) => (
                      <DropdownMenuItem
                        key={collection.id}
                        onClick={() => handleToggleCollection(collection.id)}
                      >
                        <Check className={`mr-2 h-4 w-4 ${bookCollections.includes(collection.id) ? '' : 'invisible'}`} />
                        {collection.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              
              {book.file_type === 'pdf' && (
                <DropdownMenuItem
                  onClick={handleRegenerateCover}
                  disabled={regeneratingCover}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  {regeneratingCover ? 'Generating...' : 'Regenerate Cover'}
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase">{book.file_type}</span>
          {book.page_count && (
            <>
              <span>•</span>
              <span>{book.page_count} pages</span>
            </>
          )}
          {progress > 0 && !isPending && (
            <>
              <span>•</span>
              <span>{Math.round(progress)}%</span>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
