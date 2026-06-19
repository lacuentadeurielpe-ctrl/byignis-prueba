import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ferreterias')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('id', session.ferreteriaId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const token    = data?.telegram_bot_token ?? null
  const chat_id  = data?.telegram_chat_id ?? null
  const conectado = !!(token && chat_id)

  return NextResponse.json({
    conectado,
    chat_id,
    // Enmascarar el token — solo mostrar los últimos 6 caracteres
    token_preview: token ? `***${token.slice(-6)}` : null,
  })
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const token   = (body.token   as string | undefined)?.trim() || null
  const chat_id = (body.chat_id as string | undefined)?.trim() || null

  if (token && !token.match(/^\d+:[A-Za-z0-9_-]{35,}$/)) {
    return NextResponse.json({ error: 'Formato de token inválido (debe ser NNN:XXXXXXX)' }, { status: 400 })
  }
  if (chat_id && !chat_id.match(/^-?\d+$/)) {
    return NextResponse.json({ error: 'Chat ID debe ser numérico (positivo para canal, negativo para grupo)' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ferreterias')
    .update({ telegram_bot_token: token, telegram_chat_id: chat_id })
    .eq('id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, conectado: !!(token && chat_id) })
}

export async function DELETE() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('ferreterias')
    .update({ telegram_bot_token: null, telegram_chat_id: null })
    .eq('id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, conectado: false })
}
