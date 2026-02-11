import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const user = await getUserWithTimeout(supabase)

  // Redirect to login if accessing protected route without authentication
  if (!user && !request.nextUrl.pathname.startsWith('/login') && 
      !request.nextUrl.pathname.startsWith('/register') &&
      request.nextUrl.pathname !== '/' &&
      !request.nextUrl.pathname.startsWith('/offline')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to library if authenticated user tries to access auth pages
  if (user && (request.nextUrl.pathname.startsWith('/login') || 
               request.nextUrl.pathname.startsWith('/register'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/library'
    return NextResponse.redirect(url)
  }

  return response
}

async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient>,
  timeoutMs = 2000
) {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])

    if (!result) return null
    return result.data.user
  } catch {
    return null
  }
}
