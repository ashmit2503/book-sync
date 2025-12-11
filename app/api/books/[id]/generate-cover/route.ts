import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    if (book.file_type !== 'pdf') {
      return NextResponse.json({ error: 'Cover generation only supported for PDFs' }, { status: 400 })
    }

    if (book.cover_url) {
      return NextResponse.json({ 
        success: true,
        coverUrl: book.cover_url,
        cached: true
      })
    }

    const { data: urlData } = await supabase.storage
      .from('ebooks')
      .createSignedUrl(book.file_path, 300)

    if (!urlData?.signedUrl) {
      return NextResponse.json({ error: 'Failed to access PDF' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      needsGeneration: true,
      pdfUrl: urlData.signedUrl,
      bookId: params.id
    })

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
