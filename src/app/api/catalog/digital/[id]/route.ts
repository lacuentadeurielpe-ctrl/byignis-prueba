import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const allowed = [
    'nombre', 'tipo', 'descripcion', 'precio', 'unidad',
    'descripcion_bot', 'campos_requeridos', 'preguntas_frecuentes', 'destacado',
    'metodo_entrega', 'contenido_entrega', 'mensaje_post_venta', 'vigencia',
    'cupos_totales', 'fecha_inicio', 'fecha_fin', 'activo',
  ]
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }
  if (patch.nombre) patch.nombre = String(patch.nombre).trim()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos_digitales')
    .update(patch)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase
    .from('productos_digitales')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
