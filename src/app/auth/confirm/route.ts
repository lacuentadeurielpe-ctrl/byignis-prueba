import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/onboarding'

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/auth/login?error=link_invalido', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'email' | 'signup' })

  if (error) {
    console.error('[auth/confirm]', error.message)
    return NextResponse.redirect(new URL('/auth/login?error=link_expirado', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
