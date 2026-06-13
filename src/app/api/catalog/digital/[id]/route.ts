import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

const ALLOWED_FIELDS = [
  'nombre', 'categoria', 'subcategoria', 'descripcion',
  'precio', 'precio_original', 'unidad', 'stock', 'vigencia', 'tags',
  'destacado', 'activo',
  'tipos_entrega', 'archivo_url', 'contenido_entrega', 'mensaje_entrega',
]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) patch[key] = body[key]
  }
  if (patch.nombre) patch.nombre = String(patch.nombre).trim()
  if (patch.categoria) patch.categoria = String(patch.categoria).trim()
  if ('precio' in patch) patch.precio = Number(patch.precio)
  if ('precio_original' in patch) patch.precio_original = patch.precio_original ? Number(patch.precio_original) : null
  if ('stock' in patch) patch.stock = patch.stock ? Number(patch.stock) : null

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
