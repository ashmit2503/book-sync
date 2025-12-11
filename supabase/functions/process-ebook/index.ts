import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookId, filePath } = await req.json()

    if (!bookId || !filePath) {
      throw new Error('Missing required parameters: bookId and filePath')
    }

    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update status to processing
    await supabase
      .from('books')
      .update({ processing_status: 'processing' })
      .eq('id', bookId)

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('ebooks')
      .download(filePath)

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }

    // Extract metadata based on file type
    const fileExtension = filePath.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub'
    let metadata: any = {}
    let pageCount = null

    if (fileExtension === 'pdf') {
      // For PDF, we'd use a PDF parsing library
      // Since we're in Deno, we'll use basic metadata for now
      metadata = {
        format: 'PDF',
        extractedAt: new Date().toISOString(),
      }
      
      // In a production environment, you'd use a library like:
      // import { getDocument } from 'https://esm.sh/pdfjs-dist'
      // For now, we'll skip actual PDF parsing
      pageCount = null
    } else {
      // For EPUB, similar approach
      metadata = {
        format: 'EPUB',
        extractedAt: new Date().toISOString(),
      }
    }

    // Update book with metadata
    const { error: updateError } = await supabase
      .from('books')
      .update({
        metadata,
        page_count: pageCount,
        processing_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookId)

    if (updateError) {
      throw new Error(`Failed to update book: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        bookId,
        metadata,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing ebook:', error)

    // Try to update status to failed if we have the bookId
    try {
      const { bookId } = await req.json()
      if (bookId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        await supabase
          .from('books')
          .update({ processing_status: 'failed' })
          .eq('id', bookId)
      }
    } catch (e) {
      console.error('Failed to update error status:', e)
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred processing the ebook',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
