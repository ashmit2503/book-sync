import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export type AIMode = 'chat' | 'summarize' | 'explain' | 'quiz' | 'define' | 'translate' | 'analyze'

interface ChatRequest {
  message: string
  bookContext: string
  bookTitle: string
  bookAuthor?: string
  currentPosition: number
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  mode?: AIMode
  selectedText?: string
  targetLanguage?: string
}

// Determine which AI provider to use
function getAIConfig() {
  if (process.env.GROQ_API_KEY) {
    return {
      provider: 'openai-compatible',
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.1-8b-instant',
    }
  }

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

function buildSystemPrompt(
  mode: AIMode,
  bookTitle: string,
  bookAuthor: string | undefined,
  currentPosition: number,
  selectedText?: string,
  targetLanguage?: string
): string {
  const bookRef = `"${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ''}`
  const positionNote = `The reader is at position ${currentPosition}%. CRITICAL: Never reveal, hint at, or discuss anything beyond the provided context — absolutely no spoilers.`

  const baseContext = `You are an intelligent reading companion for ${bookRef}. ${positionNote}`

  switch (mode) {
    case 'summarize':
      return `${baseContext}

Your task: Provide a clear, well-structured summary of the content the reader has covered so far.
${selectedText ? 'Focus specifically on summarizing the selected passage below.' : 'Summarize the overall content read so far.'}

Guidelines:
- Use **bold** for key terms and character names
- Organize with clear sections if the content covers multiple topics/chapters
- Keep it concise but comprehensive
- End with a brief "Key Takeaways" section with bullet points`

    case 'explain':
      return `${baseContext}

Your task: Explain the concept, passage, or idea the reader is asking about.
${selectedText ? 'The reader has selected specific text they want explained.' : ''}

Guidelines:
- Break down complex ideas into simpler parts
- Use analogies and examples when helpful
- If it's a literary device, explain its effect and purpose
- Maintain an educational but friendly tone
- Use **bold** for important terms`

    case 'quiz':
      return `${baseContext}

Your task: Create an engaging quiz based on the content the reader has covered so far.
${selectedText ? 'Focus the quiz on the selected passage.' : ''}

Format your quiz like this:
Generate 3-5 questions of varying difficulty. For each question:
1. Ask the question clearly
2. Provide 4 multiple choice options labeled A, B, C, D
3. After all questions, provide the answer key with brief explanations

Mix question types: factual recall, comprehension, and analysis/inference.
Use **bold** for question numbers.`

    case 'define':
      return `${baseContext}

Your task: Define and explain the word, phrase, or concept the reader is asking about.
${selectedText ? `The reader wants to understand: "${selectedText}"` : ''}

Guidelines:
- Provide a clear definition
- Explain it in the context of the book
- Include the literary or narrative significance if applicable
- Mention related terms or concepts from the text
- Keep it concise and informative`

    case 'translate':
      return `${baseContext}

Your task: Translate the selected text or passage.
Target language: ${targetLanguage || 'Spanish'}
${selectedText ? `Text to translate: "${selectedText}"` : ''}

Guidelines:
- Provide an accurate translation
- Preserve the tone and style of the original
- Add brief notes if there are culturally specific terms
- Show: Original → Translation format`

    case 'analyze':
      return `${baseContext}

Your task: Provide literary or deep analysis of the content.
${selectedText ? 'Analyze the selected passage in depth.' : 'Analyze the overall themes and writing in what has been read so far.'}

Guidelines:
- Discuss themes, motifs, and literary devices
- Analyze character development and relationships
- Comment on writing style, tone, and narrative structure
- Draw connections between different parts of the text
- Use **bold** for key literary terms
- Be insightful but accessible`

    case 'chat':
    default:
      return `${baseContext}

You are a knowledgeable, friendly reading assistant. Help the reader understand and engage with the book.

Guidelines:
- Answer questions based ONLY on the provided context
- Use **bold** for emphasis on key points
- Be conversational but informative
- If the reader shares their thoughts, engage thoughtfully
- Suggest interesting angles or questions they might consider
- Never make up information not in the context`
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ChatRequest = await request.json()
    const {
      message,
      bookContext,
      bookTitle,
      bookAuthor,
      currentPosition,
      chatHistory,
      mode = 'chat',
      selectedText,
      targetLanguage,
    } = body

    if (!message || !bookContext) {
      return NextResponse.json(
        { error: 'Message and book context are required' },
        { status: 400 }
      )
    }

    const aiConfig = getAIConfig()
    if (!aiConfig) {
      return NextResponse.json(
        { error: 'AI not configured. Add GROQ_API_KEY (recommended) or OPENAI_API_KEY to .env.local' },
        { status: 500 }
      )
    }

    const systemPrompt = buildSystemPrompt(
      mode,
      bookTitle,
      bookAuthor,
      currentPosition,
      selectedText,
      targetLanguage
    )

    // Context sizing: use more for analysis/summary, less for quick actions
    const contextLimit = ['summarize', 'analyze'].includes(mode) ? 16000 : 12000
    const trimmedContext = bookContext.slice(0, contextLimit)

    // Build user message with selected text context if available
    let enrichedMessage = message
    if (selectedText && mode !== 'define') {
      enrichedMessage = `[Selected text: "${selectedText.slice(0, 2000)}"]\n\n${message}`
    }

    const maxTokens = (() => {
      switch (mode) {
        case 'summarize':
        case 'analyze':
          return 800
        case 'quiz':
          return 1000
        case 'define':
        case 'translate':
          return 300
        case 'explain':
          return 600
        default:
          return 500
      }
    })()

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'system',
        content: `BOOK CONTENT READ SO FAR:\n${trimmedContext}${bookContext.length > contextLimit ? '\n[content truncated for length]' : ''}`,
      },
      ...chatHistory.slice(-8).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: enrichedMessage },
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
        max_tokens: maxTokens,
        temperature: mode === 'quiz' ? 0.8 : mode === 'define' ? 0.3 : 0.6,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI API error:', response.status, errorText)

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited. Please wait a moment and try again.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again.' },
        { status: response.status }
      )
    }

    // Stream response
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        let closed = false

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
                  closed = true
                  return
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    )
                  }
                } catch {
                  // Skip invalid JSON chunk
                }
              }
            }
          }
        } catch (streamError) {
          console.error('Stream relay error:', streamError)
          if (!closed) {
            controller.error(streamError)
          }
        } finally {
          if (!closed) {
            controller.close()
          }
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
