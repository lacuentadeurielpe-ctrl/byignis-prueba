import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

const VALID_MODES = ['fisicos', 'digitales', 'ambos'] as const

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ferreterias')
    .select('bot_modo_catalogo')
    .eq('id', session.ferreteriaId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bot_modo_catalogo: data?.bot_modo_catalogo ?? 'fisicos' })
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { modo } = body as { modo?: string }

  if (!modo || !VALID_MODES.includes(modo as typeof VALID_MODES[number])) {
    return NextResponse.json({ error: 'Modo inválido. Debe ser: fisicos, digitales o ambos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ferreterias')
    .update({ bot_modo_catalogo: modo })
    .eq('id', session.ferreteriaId)
    .select('bot_modo_catalogo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bot_modo_catalogo: data?.bot_modo_catalogo })
}
