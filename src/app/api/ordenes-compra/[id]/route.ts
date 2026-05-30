import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { estado, notas, proveedor, costo_total, items } = body
  const updateData: any = {}
  if (estado !== undefined) updateData.estado = estado
  if (notas !== undefined) updateData.notas = notas
  if (proveedor !== undefined) updateData.proveedor = proveedor
  if (costo_total !== undefined) updateData.costo_total = costo_total

  // Si hay items a actualizar, validamos primero
  if (items !== undefined) {
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Items debe ser un array' }, { status: 400 })
    }
    for (const item of items) {
      if (!item.nombre_producto) {
        return NextResponse.json({ error: 'Todos los items deben tener un nombre_producto' }, { status: 400 })
      }
      if (typeof item.cantidad !== 'number' || item.cantidad <= 0) {
        return NextResponse.json({ error: 'La cantidad debe ser un número mayor a 0' }, { status: 400 })
      }
    }
  }

  // Si hay campos de cabecera a actualizar
  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabase
      .from('ordenes_compra')
      .update(updateData)
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }
  }

  // Si se pasaron items, eliminamos los anteriores e insertamos los nuevos
  if (items !== undefined) {
    const { error: deleteError } = await supabase
      .from('items_orden_compra')
      .delete()
      .eq('orden_compra_id', id)

    if (deleteError) {
      return NextResponse.json({ error: 'Error al limpiar items anteriores: ' + deleteError.message }, { status: 400 })
    }

    if (items.length > 0) {
      const itemsToInsert = items.map((i: any) => ({
        orden_compra_id: id,
        producto_id: i.producto_id || null,
        nombre_producto: i.nombre_producto,
        marca: i.marca || null,
        unidad: i.unidad || 'unidad',
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal
      }))

      const { error: insertItemsError } = await supabase
        .from('items_orden_compra')
        .insert(itemsToInsert)

      if (insertItemsError) {
        return NextResponse.json({ error: 'Error al insertar nuevos items: ' + insertItemsError.message }, { status: 400 })
      }
    }
  }

  // Retornar la orden actualizada con sus nuevos items
  const { data: updatedOrden, error: fetchError } = await supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 })
  }

  return NextResponse.json(updatedOrden)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  // Eliminar la orden. (Los items se eliminarán automáticamente por ON DELETE CASCADE)
  const { error } = await supabase
    .from('ordenes_compra')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

