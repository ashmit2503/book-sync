'use client'

import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2, X, Plus, Check } from 'lucide-react'
import { validateEbookFile } from '@/lib/utils/upload'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCollections, useTags, Tag, Collection } from '@/lib/hooks/useLibrary'
import { createClient } from '@/lib/supabase/client'
import { generateCoverFromFile } from '@/lib/utils/generateCover'
import ePub from 'epubjs'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

interface BookUploadFormProps {
  userId: string
  onUploadComplete?: () => void
}

interface BookMetadata {
  title: string
  author: string
  description: string
}

export function BookUploadForm({ userId, onUploadComplete }: BookUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'metadata' | 'uploading'>('select')
  const [extractingMetadata, setExtractingMetadata] = useState(false)
  
  // Metadata fields
  const [metadata, setMetadata] = useState<BookMetadata>({
    title: '',
    author: '',
    description: '',
  })
  
  // Tags and collections
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  
  const router = useRouter()
  const { collections, createCollection } = useCollections()
  const { tags, createTag, addTagToBook } = useTags()
  const { addBookToCollection } = useCollections()

  // Extract metadata from EPUB
  const extractEPUBMetadata = async (file: File): Promise<Partial<BookMetadata>> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const book = ePub(arrayBuffer as any)
      await book.ready
      
      const metadata = await book.loaded.metadata
      
      return {
        title: metadata.title || file.name.replace(/\.epub$/i, ''),
        author: metadata.creator || '',
        description: metadata.description || '',
      }
    } catch (error) {
      console.error('Failed to extract EPUB metadata:', error)
      return {
        title: file.name.replace(/\.epub$/i, ''),
        author: '',
        description: '',
      }
    }
  }

  // Extract metadata from PDF
  const extractPDFMetadata = async (file: File): Promise<Partial<BookMetadata>> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const metadata = await pdf.getMetadata()
      
      const info = metadata.info as any
      
      return {
        title: info?.Title || file.name.replace(/\.pdf$/i, ''),
        author: info?.Author || '',
        description: info?.Subject || '',
      }
    } catch (error) {
      console.error('Failed to extract PDF metadata:', error)
      return {
        title: file.name.replace(/\.pdf$/i, ''),
        author: '',
        description: '',
      }
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0]
      if (!selectedFile) return

      // Validate file
      const validation = validateEbookFile(selectedFile)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }

      setError(null)
      setFile(selectedFile)
      setExtractingMetadata(true)
      
      // Extract metadata
      const isEpub = selectedFile.name.toLowerCase().endsWith('.epub')
      const extractedMetadata = isEpub 
        ? await extractEPUBMetadata(selectedFile)
        : await extractPDFMetadata(selectedFile)
      
      setMetadata({
        title: extractedMetadata.title || selectedFile.name.replace(/\.(pdf|epub)$/i, ''),
        author: extractedMetadata.author || '',
        description: extractedMetadata.description || '',
      })
      
      setExtractingMetadata(false)
      setStep('metadata')
    },
    []
  )

  const handleSaveToLibrary = async () => {
    if (!file) return

    setStep('uploading')
    setUploading(true)
    setProgress(0)

    const supabase = createClient()

    try {
      // Get file info
      const fileName = file.name
      const ext = fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub'
      const contentType = ext === 'epub' ? 'application/epub+zip' : 'application/pdf'

      // 1. Create database record
      setProgress(10)
      const { data: book, error: dbError } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: metadata.title,
          author: metadata.author || null,
          metadata: { description: metadata.description },
          file_size: file.size,
          file_type: ext,
          file_path: '',
          processing_status: 'pending',
        })
        .select()
        .single()

      if (dbError) {
        throw new Error(`Failed to create book record: ${dbError.message}`)
      }

      // 2. Upload to storage
      setProgress(30)
      const filePath = `${userId}/${book.id}/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('ebooks')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType,
        })

      if (uploadError) {
        await supabase.from('books').delete().eq('id', book.id)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // 3. Update book record with file path
      setProgress(60)
      await supabase
        .from('books')
        .update({
          file_path: filePath,
          processing_status: 'completed',
        })
        .eq('id', book.id)

      // 4. Add tags to book
      setProgress(70)
      for (const tagId of selectedTags) {
        await addTagToBook(book.id, tagId)
      }

      // 5. Add book to collections
      setProgress(80)
      for (const collectionId of selectedCollections) {
        await addBookToCollection(collectionId, book.id)
      }

      // 6. Generate cover (async)
      setProgress(90)
      setTimeout(async () => {
        try {
          await generateCoverFromFile(book.id, file, userId)
        } catch (err) {
          console.error('Cover generation failed:', err)
        }
      }, 100)

      setProgress(100)

      // Success - redirect to library
      setTimeout(() => {
        router.push('/library')
        router.refresh()
        onUploadComplete?.()
      }, 500)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
      setStep('metadata')
    }
  }

  const handleCancel = () => {
    setFile(null)
    setMetadata({ title: '', author: '', description: '' })
    setSelectedTags([])
    setSelectedCollections([])
    setStep('select')
    setError(null)
  }

  const [isCreatingTag, setIsCreatingTag] = useState(false)
  
  const handleCreateTag = async () => {
    if (!newTagName.trim() || isCreatingTag) return
    
    setIsCreatingTag(true)
    try {
      const tag = await createTag(newTagName.trim())
      if (tag) {
        // Add to selected if not already there
        if (!selectedTags.includes(tag.id)) {
          setSelectedTags([...selectedTags, tag.id])
        }
        setNewTagName('')
        setShowNewTagInput(false)
      } else {
        setError('Failed to create tag. Please try again.')
      }
    } catch (err) {
      console.error('Tag creation error:', err)
      setError('Failed to create tag. Please try again.')
    } finally {
      setIsCreatingTag(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const toggleCollection = (collectionId: string) => {
    setSelectedCollections(prev =>
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    )
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/epub+zip': ['.epub'],
      'application/epub': ['.epub'],
      'application/octet-stream': ['.epub'],
    },
    maxSize: 500 * 1024 * 1024,
    multiple: false,
    disabled: step !== 'select',
  })

  if (step === 'select') {
    return (
      <div className="w-full">
        <div
          {...getRootProps()}
          className={`
            flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            cursor-pointer hover:border-primary hover:bg-muted/50
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">
            {isDragActive ? 'Drop your book here' : 'Upload your ebook'}
          </p>
          <p className="text-sm text-muted-foreground">
            Drag and drop or click to select a PDF or EPUB file
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Maximum file size: 5MB
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    )
  }

  if (step === 'metadata') {
    return (
      <div className="w-full space-y-6">
        {/* File info */}
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{file?.name}</p>
            <p className="text-sm text-muted-foreground">
              {file && (file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {extractingMetadata ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Extracting metadata...</span>
          </div>
        ) : (
          <>
            {/* Metadata fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={metadata.title}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  placeholder="Book title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={metadata.author}
                  onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                  placeholder="Author name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={metadata.description}
                  onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                  placeholder="Book description (optional)"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${
                      selectedTags.includes(tag.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                    style={selectedTags.includes(tag.id) ? {} : { backgroundColor: tag.color + '30', color: tag.color }}
                  >
                    {selectedTags.includes(tag.id) && <Check className="h-3 w-3" />}
                    {tag.name}
                  </button>
                ))}
                {showNewTagInput ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag name"
                      className="h-8 w-32"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                      autoFocus
                      disabled={isCreatingTag}
                    />
                    <Button size="sm" variant="ghost" onClick={handleCreateTag} disabled={isCreatingTag}>
                      {isCreatingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewTagInput(false)} disabled={isCreatingTag}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewTagInput(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm hover:bg-secondary/80"
                  >
                    <Plus className="h-3 w-3" />
                    New Tag
                  </button>
                )}
              </div>
            </div>

            {/* Collections */}
            <div className="space-y-2">
              <Label>Collections</Label>
              <div className="flex flex-wrap gap-2">
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => toggleCollection(collection.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${
                      selectedCollections.includes(collection.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    {selectedCollections.includes(collection.id) && <Check className="h-3 w-3" />}
                    {collection.name}
                  </button>
                ))}
                {collections.length === 0 && (
                  <p className="text-sm text-muted-foreground">No collections yet. Create one in your library.</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveToLibrary} 
                disabled={!metadata.title.trim()}
                className="flex-1"
              >
                Save to Library
              </Button>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    )
  }

  // Uploading step
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
      <p className="mb-2 text-lg font-medium">Saving to Library...</p>
      <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" />
        {metadata.title}
      </p>
      <div className="w-full max-w-xs">
        <Progress value={progress} className="h-2" />
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {progress < 100 ? `${Math.round(progress)}%` : 'Finishing up...'}
        </p>
      </div>
    </div>
  )
}
