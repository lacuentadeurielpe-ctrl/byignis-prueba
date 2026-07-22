import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /auth/confirm — destino de los enlaces de confirmación de correo.
 *
 * Supabase puede llegar aquí en dos formatos según la plantilla del correo:
 *   a) ?code=...                → flujo PKCE (plantilla por defecto con
 *      {{ .ConfirmationURL }}): hay que canjear el code por la sesión.
 *   b) ?token_hash=...&type=... → plantilla personalizada con {{ .TokenHash }}.
 *
 * Antes el correo redirigía directo a /onboarding con ?code — nadie canjeaba
 * el code, el proxy veía "sin sesión" y pateaba al usuario a /auth/login:
 * cuenta confirmada pero usuario deslogueado en la landing (el "bucle").
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? searchParams.get('redirect_to') ?? '/onboarding'

  // Supabase también puede redirigir con un error explícito (enlace vencido)
  const errorCode = searchParams.get('error_code') ?? searchParams.get('error')
  if (errorCode && !token_hash && !code) {
    return NextResponse.redirect(new URL('/auth/login?error=link_expirado', request.url))
  }

  if (!code && (!token_hash || !type)) {
    return NextResponse.redirect(new URL('/auth/login?error=link_invalido', request.url))
  }

  // Crear la respuesta de redirect ANTES — las cookies se setean en ella
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

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: token_hash!, type: type as 'email' | 'signup' })

  if (error) {
    console.error('[auth/confirm]', error.message)
    // Caso cross-device: el usuario se registró en un navegador pero abrió el
    // correo en otro (típicamente el celular). El "code verifier" solo existe
    // en el navegador original, así que el canje falla — PERO el correo ya
    // quedó confirmado en Supabase antes de esta redirección. Solo necesita
    // iniciar sesión, no es un enlace vencido.
    const verifierFaltante = /code verifier/i.test(error.message)
    return NextResponse.redirect(
      new URL(
        verifierFaltante ? '/auth/login?info=correo_confirmado' : '/auth/login?error=link_expirado',
        request.url,
      ),
    )
  }

  return response
}
