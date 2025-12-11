import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PDFReader } from '@/components/readers/PDFReader'
import { EPUBReader } from '@/components/readers/EPUBReader'

interface ReadPageProps {
  params: {
    bookId: string
  }
}

export default async function ReadPage({ params }: ReadPageProps) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch book details
  const { data: book, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (error || !book) {
    notFound()
  }

  // Check if book is still processing
  if (book.processing_status === 'pending' || book.processing_status === 'processing') {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/library">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Library
            </Button>
          </Link>
        </div>
        
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <h3 className="mb-2 text-lg font-semibold">Processing Book</h3>
          <p className="text-center text-sm text-muted-foreground">
            Your book is being processed. This usually takes a few moments.
            <br />
            Please check back shortly.
          </p>
        </div>
      </div>
    )
  }

  if (book.processing_status === 'failed') {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/library">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Library
            </Button>
          </Link>
        </div>
        
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <h3 className="mb-2 text-lg font-semibold text-destructive">Processing Failed</h3>
          <p className="text-center text-sm text-muted-foreground">
            There was an error processing this book.
            <br />
            Please try re-uploading it.
          </p>
        </div>
      </div>
    )
  }

  // Generate signed URL for the book file
  const { data: urlData } = await supabase.storage
    .from('ebooks')
    .createSignedUrl(book.file_path, 3600) // 1 hour expiry

  if (!urlData?.signedUrl) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/library">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Library
            </Button>
          </Link>
        </div>
        
        <div className="rounded-lg border bg-destructive/10 p-6 text-center">
          <p className="text-destructive">Failed to load book file. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/library">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{book.title}</h1>
            {book.author && (
              <p className="text-sm text-muted-foreground">{book.author}</p>
            )}
          </div>
        </div>
      </div>

      {/* Reader */}
      {book.file_type === 'pdf' ? (
        <PDFReader 
          bookId={book.id} 
          fileUrl={urlData.signedUrl}
          bookTitle={book.title}
          bookAuthor={book.author || undefined}
        />
      ) : (
        <EPUBReader 
          bookId={book.id} 
          fileUrl={urlData.signedUrl}
          bookTitle={book.title}
          bookAuthor={book.author || undefined}
        />
      )}
    </div>
  )
}
