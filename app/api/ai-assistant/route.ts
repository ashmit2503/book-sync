import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ChatRequest {
  message: string
  bookContext: string
  bookTitle: string
  bookAuthor?: string
  currentPosition: number // Page number or percentage
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
}

// Determine which AI provider to use (prioritize free-ish Groq first)
function getAIConfig() {
  // Groq free tier (LLama 3.1 8B instant) – generous and fast
  if (process.env.GROQ_API_KEY) {
    return {
      provider: 'openai-compatible',
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.1-8b-instant',
    }
  }

  // OpenAI (paid) fallback if available
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai-compatible',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ChatRequest = await request.json()
    const { message, bookContext, bookTitle, bookAuthor, currentPosition, chatHistory } = body

    if (!message || !bookContext) {
      return NextResponse.json(
        { error: 'Message and book context are required' },
        { status: 400 }
      )
    }

    // Get AI configuration
    const aiConfig = getAIConfig()
    if (!aiConfig) {
      return NextResponse.json(
        { error: 'AI not configured. Add GROQ_API_KEY (recommended) or OPENAI_API_KEY to .env.local' },
        { status: 500 }
      )
    }

    // Build the system prompt - keep it short to reduce tokens
    const systemPrompt = `You are a reading assistant for "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ''}. The reader is currently at position ${currentPosition}. IMPORTANT: Only discuss content from the provided context. Never reveal or hint at anything beyond what's shown - no spoilers.`

    // Trim context to reduce token usage and rate-limit pressure
    const trimmedContext = bookContext.slice(0, 12000)

    // OpenAI-compatible API (Groq, OpenAI)
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `CONTEXT:\n${trimmedContext}${bookContext.length > 12000 ? '\n[truncated]' : ''}` },
        ...chatHistory.slice(-6).map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: message },
    ]

    const response = await fetch(aiConfig.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages,
          stream: true,
          max_tokens: 400,
          temperature: 0.6,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('AI API error:', response.status, errorText)
        return NextResponse.json(
          { error: 'AI service temporarily unavailable or rate-limited. Please wait a few seconds and try again.' },
          { status: response.status }
        )
    }

    // Stream OpenAI-compatible response
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()

        if (!reader) {
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = decoder.decode(value)
            const lines = text.split('\n').filter((line) => line.trim())

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  controller.close()
                  return
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                } catch {
                  // Skip invalid JSON chunk
                }
              }
            }
          }
        } catch (streamError) {
          console.error('Stream relay error:', streamError)
          controller.error(streamError)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI Assistant error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
