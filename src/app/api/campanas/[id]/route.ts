import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('campanas')
    .select('*, plantillas_wa(*), campana_destinatarios(id, estado, clientes(nombre, telefono))')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campanas')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data: campana } = await supabase
    .from('campanas').select('estado').eq('id', id).eq('ferreteria_id', session.ferreteriaId).single()

  if (campana?.estado === 'enviando') {
    return NextResponse.json({ error: 'No se puede eliminar una campaña en curso' }, { status: 409 })
  }

  const { error } = await supabase
    .from('campanas').delete().eq('id', id).eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
