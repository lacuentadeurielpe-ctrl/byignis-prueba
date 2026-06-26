import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

type Params = { params: Promise<{ id: string }> }

// GET /api/bandeja/[id]/etiquetas
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversacion_etiquetas')
    .select('etiqueta_id, asignado_at, etiquetas(id, nombre, color)')
    .eq('conversacion_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/bandeja/[id]/etiquetas — { etiqueta_id }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { etiqueta_id } = await req.json()
  if (!etiqueta_id) return NextResponse.json({ error: 'etiqueta_id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('conversacion_etiquetas')
    .upsert({ conversacion_id: id, etiqueta_id }, { onConflict: 'conversacion_id,etiqueta_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/bandeja/[id]/etiquetas?etiqueta_id=...
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const etiqueta_id = new URL(req.url).searchParams.get('etiqueta_id')
  if (!etiqueta_id) return NextResponse.json({ error: 'etiqueta_id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('conversacion_etiquetas')
    .delete()
    .eq('conversacion_id', id)
    .eq('etiqueta_id', etiqueta_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
