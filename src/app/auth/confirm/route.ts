import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/onboarding'

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/auth/login?error=link_invalido', request.url))
  }

  // Crear la respuesta de redirect ANTES — las cookies se setean en ella, no en cookieStore
  const redirectUrl = new URL(next, request.url)
  const response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'email' | 'signup' })

  if (error) {
    console.error('[auth/confirm]', error.message)
    return NextResponse.redirect(new URL('/auth/login?error=link_expirado', request.url))
  }

  return response
}
