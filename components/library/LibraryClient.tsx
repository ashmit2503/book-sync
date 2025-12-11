'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCollections, useTags, Tag } from '@/lib/hooks/useLibrary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookCard } from '@/components/library/BookCard'
import {
  Plus,
  Search,
  SortAsc,
  SortDesc,
  Grid,
  List,
  FolderOpen,
  Tag as TagIcon,
  ChevronDown,
  X,
  Check,
  Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'

interface ReadingProgress {
  currentPage?: number
  totalPages?: number
  percentage?: number
  lastRead?: string | null
}

interface Book {
  id: string
  user_id: string
  title: string
  author: string | null
  file_path: string
  file_size: number
  file_type: 'pdf' | 'epub'
  cover_url: string | null
  page_count: number | null
  metadata: any
  reading_progress: ReadingProgress | any
  created_at: string
  updated_at: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  tags?: Tag[]
}

// Helper to safely get reading progress percentage
function getProgressPercentage(book: Book): number {
  const progress = book.reading_progress as ReadingProgress | null
  return progress?.percentage || 0
}

// Helper to safely get last read date
function getLastReadDate(book: Book): Date | null {
  const progress = book.reading_progress as ReadingProgress | null
  return progress?.lastRead ? new Date(progress.lastRead) : null
}

type SortField = 'title' | 'author' | 'created_at' | 'updated_at' | 'progress'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'grid' | 'list'

export function LibraryClient({ initialBooks }: { initialBooks: Book[] }) {
  const [books, setBooks] = useState<Book[]>(initialBooks)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const { collections, isLoading: collectionsLoading, getBooksInCollection } = useCollections()
  const { tags, isLoading: tagsLoading, getTagsForBook } = useTags()

  // Optimistic delete - immediately remove book from UI
  const handleBookDeleted = (bookId: string) => {
    setBooks(prev => prev.filter(book => book.id !== bookId))
  }

  // Load tags for each book
  useEffect(() => {
    async function loadBookTags() {
      const booksWithTags = await Promise.all(
        books.map(async (book) => {
          const bookTags = await getTagsForBook(book.id)
          return { ...book, tags: bookTags }
        })
      )
      setBooks(booksWithTags)
    }

    if (!tagsLoading && books.length > 0) {
      loadBookTags()
    }
  }, [tagsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter and sort books
  const filteredBooks = useMemo(() => {
    let result = [...books]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          (book.author && book.author.toLowerCase().includes(query)) ||
          book.tags?.some((tag) => tag.name.toLowerCase().includes(query))
      )
    }

    // Tag filter
    if (selectedTags.length > 0) {
      result = result.filter((book) =>
        selectedTags.every((tagId) =>
          book.tags?.some((tag) => tag.id === tagId)
        )
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '')
          break
        case 'author':
          comparison = (a.author || 'zzz').localeCompare(b.author || 'zzz')
          break
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'updated_at':
          // Use lastRead from reading_progress for "Last Opened"
          const lastReadA = getLastReadDate(a)
          const lastReadB = getLastReadDate(b)
          const timeA = lastReadA ? lastReadA.getTime() : new Date(a.updated_at).getTime()
          const timeB = lastReadB ? lastReadB.getTime() : new Date(b.updated_at).getTime()
          comparison = timeA - timeB
          break
        case 'progress':
          const progressA = getProgressPercentage(a)
          const progressB = getProgressPercentage(b)
          comparison = progressA - progressB
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [books, searchQuery, selectedTags, sortField, sortDirection])

  // Load books from collection
  const handleCollectionSelect = async (collectionId: string | null) => {
    setSelectedCollection(collectionId)

    if (!collectionId) {
      // Reset to all books
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (data) {
        setBooks(data)
      }
    } else {
      setIsLoading(true)
      const collectionBooks = await getBooksInCollection(collectionId)
      setBooks(collectionBooks)
      setIsLoading(false)
    }
  }

  const toggleTagFilter = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTags([])
    setSelectedCollection(null)
    handleCollectionSelect(null)
  }

  const hasActiveFilters = searchQuery || selectedTags.length > 0 || selectedCollection

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'created_at', label: 'Date Added' },
    { field: 'updated_at', label: 'Last Opened' },
    { field: 'title', label: 'Title' },
    { field: 'author', label: 'Author' },
    { field: 'progress', label: 'Progress' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredBooks.length} of {books.length} book{books.length === 1 ? '' : 's'}
            {selectedCollection && collections.find((c) => c.id === selectedCollection) && (
              <span> in {collections.find((c) => c.id === selectedCollection)?.name}</span>
            )}
          </p>
        </div>
        <Link href="/upload">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Book
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search books by title, author, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Collections Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                {selectedCollection
                  ? collections.find((c) => c.id === selectedCollection)?.name || 'Collection'
                  : 'All Books'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Collections</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleCollectionSelect(null)}>
                <Check className={`mr-2 h-4 w-4 ${!selectedCollection ? '' : 'invisible'}`} />
                All Books
              </DropdownMenuItem>
              {collectionsLoading ? (
                <DropdownMenuItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </DropdownMenuItem>
              ) : collections.length === 0 ? (
                <DropdownMenuItem disabled>No collections yet</DropdownMenuItem>
              ) : (
                collections.map((collection) => (
                  <DropdownMenuItem
                    key={collection.id}
                    onClick={() => handleCollectionSelect(collection.id)}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedCollection === collection.id ? '' : 'invisible'
                      }`}
                    />
                    {collection.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {collection.book_count}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tags Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <TagIcon className="h-4 w-4" />
                Tags
                {selectedTags.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                    {selectedTags.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by Tags</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tagsLoading ? (
                <DropdownMenuItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </DropdownMenuItem>
              ) : tags.length === 0 ? (
                <DropdownMenuItem disabled>No tags yet</DropdownMenuItem>
              ) : (
                tags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() => toggleTagFilter(tag.id)}
                  >
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {tag.book_count}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                {sortDirection === 'asc' ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
                Sort
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.field}
                  onClick={() => {
                    if (sortField === option.field) {
                      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                    } else {
                      setSortField(option.field)
                      setSortDirection('desc')
                    }
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      sortField === option.field ? '' : 'invisible'
                    }`}
                  />
                  {option.label}
                  {sortField === option.field && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedCollection && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs">
                Collection: {collections.find((c) => c.id === selectedCollection)?.name}
                <button onClick={() => handleCollectionSelect(null)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedTags.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId)
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                  style={{ backgroundColor: tag?.color + '30', color: tag?.color }}
                >
                  {tag?.name}
                  <button onClick={() => toggleTagFilter(tagId)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Book Grid/List */}
      {isLoading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed">
          {books.length === 0 ? (
            <>
              <svg
                className="mb-4 h-16 w-16 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <h3 className="mb-2 text-lg font-semibold">No books yet</h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Start building your digital library by uploading your first ebook
              </p>
              <Link href="/upload">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Upload Your First Book
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Search className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No matching books</h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Try adjusting your search or filters
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} onUpdate={() => handleBookDeleted(book.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBooks.map((book) => (
            <Link
              key={book.id}
              href={`/library/${book.id}/read`}
              className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              {/* Cover */}
              <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <svg
                      className="h-8 w-8 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{book.title}</h3>
                {book.author && (
                  <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase">
                    {book.file_type}
                  </span>
                  {getProgressPercentage(book) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(getProgressPercentage(book))}% complete
                    </span>
                  )}
                </div>
                {book.tags && book.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {book.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{ backgroundColor: tag.color + '30', color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {book.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{book.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Progress */}
              {getProgressPercentage(book) > 0 && (
                <div className="w-24">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${getProgressPercentage(book)}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
