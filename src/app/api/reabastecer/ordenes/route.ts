import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/reabastecer/ordenes — Listar proformas/órdenes de compra
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  
  // Obtener órdenes
  const { data: ordenes, error } = await supabase
    .from('ordenes_compra')
    .select('*, items:items_orden_compra(*), proveedores(*)')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(ordenes)
}

// POST /api/reabastecer/ordenes — Crear una proforma de compra con sus ítems
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { proveedor_id, proveedor_nombre, total, items } = body

  if (!proveedor_nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre del proveedor es obligatorio.' }, { status: 400 })
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'La orden debe contener al menos un producto.' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Crear la cabecera de la orden
  const { data: orden, error: errOrden } = await supabase
    .from('ordenes_compra')
    .insert({
      ferreteria_id: session.ferreteriaId,
      proveedor_id: proveedor_id || null,
      proveedor_nombre: proveedor_nombre.trim(),
      total: Number(total) || 0,
      estado: 'pendiente' // siempre inicia pendiente
    })
    .select()
    .single()

  if (errOrden) return NextResponse.json({ error: errOrden.message }, { status: 500 })

  // 2. Crear los ítems de la orden
  const itemsPayload = items.map((i: any) => ({
    orden_compra_id: orden.id,
    producto_id: i.producto_id || null,
    nombre: i.nombre.trim(),
    marca: i.marca?.trim() || null,
    cantidad: Number(i.cantidad) || 1,
    precio_compra: Number(i.precio_compra) || 0,
    unidad: i.unidad || 'unidad'
  }))

  const { error: errItems } = await supabase
    .from('items_orden_compra')
    .insert(itemsPayload)

  if (errItems) {
    // Si falla la inserción de items, intentamos borrar la cabecera huérfana
    await supabase.from('ordenes_compra').delete().eq('id', orden.id)
    return NextResponse.json({ error: errItems.message }, { status: 500 })
  }

  // 3. Obtener orden completa para responder
  const { data: ordenCompleta } = await supabase
    .from('ordenes_compra')
    .select('*, items:items_orden_compra(*), proveedores(*)')
    .eq('id', orden.id)
    .single()

  return NextResponse.json(ordenCompleta, { status: 201 })
}
