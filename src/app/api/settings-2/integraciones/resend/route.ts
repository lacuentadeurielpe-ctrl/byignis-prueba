import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

function maskKey(key: string | null): string | null {
  if (!key) return null
  return `re_${'*'.repeat(32)}${key.slice(-4)}`
}

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ferreterias')
    .select('resend_api_key, resend_from_email')
    .eq('id', session.ferreteriaId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    api_key_masked: maskKey(data?.resend_api_key ?? null),
    from_email:     data?.resend_from_email ?? null,
    connected:      !!(data?.resend_api_key && data?.resend_from_email),
  })
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const apiKey    = (body.api_key    as string | undefined)?.trim()
  const fromEmail = (body.from_email as string | undefined)?.trim()

  if (!apiKey || !fromEmail) {
    return NextResponse.json({ error: 'api_key y from_email son requeridos' }, { status: 400 })
  }

  if (!/^re_[A-Za-z0-9_-]{30,}$/.test(apiKey)) {
    return NextResponse.json({ error: 'Formato de API key inválido (debe comenzar con re_)' }, { status: 400 })
  }

  if (!/^[^@]+@[^@]+\.[^@]+$/.test(fromEmail)) {
    return NextResponse.json({ error: 'Email de envío inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ferreterias')
    .update({ resend_api_key: apiKey, resend_from_email: fromEmail })
    .eq('id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('ferreterias')
    .update({ resend_api_key: null, resend_from_email: null })
    .eq('id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
