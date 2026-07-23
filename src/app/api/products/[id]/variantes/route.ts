import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/products/[id]/variantes — listar variantes del producto
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: productoId } = await params

  const { data, error } = await supabase
    .from('variantes_producto')
    .select('*')
    .eq('producto_id', productoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('nombre_variante', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/products/[id]/variantes — crear o reemplazar variantes del producto
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: productoId } = await params
  const body = await request.json()

  // Se puede pasar una variante individual o un array de variantes
  const variantesInput = Array.isArray(body) ? body : [body]

  const variantesToInsert = variantesInput.map((v: any) => ({
    ferreteria_id: session.ferreteriaId,
    producto_id: productoId,
    nombre_variante: v.nombre_variante,
    sku: v.sku || null,
    precio: v.precio != null ? Number(v.precio) : null,
    precio_compra: v.precio_compra != null ? Number(v.precio_compra) : null,
    stock: Number(v.stock || 0),
    stock_minimo: Number(v.stock_minimo || 0),
    imagen_url: v.imagen_url || null,
    activo: v.activo !== false,
    venta_sin_stock: v.venta_sin_stock === true,
    valores_ids: Array.isArray(v.valores_ids) ? v.valores_ids : []
  }))

  const { data, error } = await supabase
    .from('variantes_producto')
    .insert(variantesToInsert)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/products/[id]/variantes — actualizar una variante específica por body.id
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: productoId } = await params
  const body = await request.json()
  const { id: varianteId, ...fields } = body

  if (!varianteId) return NextResponse.json({ error: 'ID de variante requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('variantes_producto')
    .update(fields)
    .eq('id', varianteId)
    .eq('producto_id', productoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/products/[id]/variantes — borrar variante por query param ?varianteId=...
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: productoId } = await params
  const { searchParams } = new URL(request.url)
  const varianteId = searchParams.get('varianteId')

  if (!varianteId) return NextResponse.json({ error: 'varianteId requerido' }, { status: 400 })

  const { error } = await supabase
    .from('variantes_producto')
    .delete()
    .eq('id', varianteId)
    .eq('producto_id', productoId)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
