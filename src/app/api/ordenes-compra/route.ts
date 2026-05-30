import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*)')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { proveedor, costo_total, notas, items } = body

  if (!proveedor || !items || items.length === 0) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // Obtener siguiente número de orden
  const { data: numeroData, error: numError } = await supabase
    .rpc('generar_numero_orden_compra')

  if (numError) {
    return NextResponse.json({ error: 'Error generando correlativo', detalle: numError.message }, { status: 500 })
  }

  const numero_orden = numeroData || `OC-TEMP-${Date.now()}`

  // Insertar cabecera
  const { data: orden, error: insertError } = await supabase
    .from('ordenes_compra')
    .insert({
      ferreteria_id: session.ferreteriaId,
      proveedor,
      numero_orden,
      costo_total,
      notas: notas || null,
      estado: 'borrador'
    })
    .select()
    .single()

  if (insertError || !orden) {
    return NextResponse.json({ error: insertError?.message }, { status: 400 })
  }

  // Insertar items
  const itemsToInsert = items.map((i: any) => ({
    orden_compra_id: orden.id,
    producto_id: i.producto_id || null,
    nombre_producto: i.nombre_producto,
    marca: i.marca || null,
    unidad: i.unidad || 'unidad',
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.subtotal
  }))

  const { error: itemsError } = await supabase
    .from('items_orden_compra')
    .insert(itemsToInsert)

  if (itemsError) {
    // Revertir si hay error
    await supabase.from('ordenes_compra').delete().eq('id', orden.id)
    return NextResponse.json({ error: itemsError.message }, { status: 400 })
  }

  return NextResponse.json(orden)
}
