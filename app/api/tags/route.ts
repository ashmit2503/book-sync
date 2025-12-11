import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Use Node.js runtime so service-role client works reliably
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = (body?.name ?? '').trim()
    const color = (body?.color as string | undefined) || '#6b7280'

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      return NextResponse.json({ error: 'Auth error', details: authError.message }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use service role to avoid any client-side auth edge cases while still setting user_id for RLS integrity
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await admin
      .from('tags')
      .insert({ user_id: user.id, name, color })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        // Duplicate tag, return existing
        const { data: existing } = await supabase
          .from('tags')
          .select('*')
          .eq('user_id', user.id)
          .eq('name', name)
          .single()
        return NextResponse.json({ tag: existing, duplicate: true })
      }

      return NextResponse.json({
        error: 'Failed to create tag',
        details: error.message,
        code: error.code,
      }, { status: 500 })
    }

    return NextResponse.json({ tag: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Unexpected error', message }, { status: 500 })
  }
}
