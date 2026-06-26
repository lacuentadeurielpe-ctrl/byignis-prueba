import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/etiquetas/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if ('nombre' in body) update.nombre = String(body.nombre).trim()
  if ('color'  in body) update.color  = body.color
  if ('orden'  in body) update.orden  = Number(body.orden)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('etiquetas')
    .update(update)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/etiquetas/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('etiquetas')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
