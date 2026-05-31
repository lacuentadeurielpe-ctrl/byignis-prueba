import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// PATCH /api/reabastecer/ordenes/[id] — Modificar proforma (cabecera e ítems)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { items, ...ordenData } = body

  const supabase = await createClient()

  // 1. Verificar que la orden exista y pertenezca al tenant y NO esté en estado 'recibido'
  const { data: ordenExistente, error: errFetch } = await supabase
    .from('ordenes_compra')
    .select('estado')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errFetch || !ordenExistente) {
    return NextResponse.json({ error: 'Orden de compra no encontrada.' }, { status: 404 })
  }

  if (ordenExistente.estado === 'recibido') {
    return NextResponse.json({ error: 'No se puede modificar una orden que ya ha sido recibida en inventario.' }, { status: 400 })
  }

  // 2. Actualizar datos de cabecera
  const { error: errUpdate } = await supabase
    .from('ordenes_compra')
    .update({ ...ordenData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 500 })

  // 3. Reemplazar ítems si se envían
  if (items && Array.isArray(items)) {
    // Eliminar anteriores
    await supabase.from('items_orden_compra').delete().eq('orden_compra_id', id)

    // Insertar nuevos
    if (items.length > 0) {
      const itemsPayload = items.map((i: any) => ({
        orden_compra_id: id,
        producto_id: i.producto_id || null,
        nombre: i.nombre.trim(),
        marca: i.marca?.trim() || null,
        cantidad: Number(i.cantidad) || 1,
        precio_compra: Number(i.precio_compra) || 0,
        unidad: i.unidad || 'unidad'
      }))

      const { error: errInsertItems } = await supabase
        .from('items_orden_compra')
        .insert(itemsPayload)

      if (errInsertItems) return NextResponse.json({ error: errInsertItems.message }, { status: 500 })
    }
  }

  // 4. Obtener orden actualizada
  const { data: ordenActualizada } = await supabase
    .from('ordenes_compra')
    .select('*, items:items_orden_compra(*), proveedores(*)')
    .eq('id', id)
    .single()

  return NextResponse.json(ordenActualizada)
}

// DELETE /api/reabastecer/ordenes/[id] — Eliminar proforma
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  // 1. Verificar estado actual
  const { data: ordenExistente, error: errFetch } = await supabase
    .from('ordenes_compra')
    .select('estado')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errFetch || !ordenExistente) {
    return NextResponse.json({ error: 'Orden de compra no encontrada.' }, { status: 404 })
  }

  if (ordenExistente.estado === 'recibido') {
    return NextResponse.json({ error: 'No se puede eliminar una orden que ya ha sido recibida en inventario.' }, { status: 400 })
  }

  // 2. Eliminar de la base de datos (se borran sus items por cascade onDelete)
  const { error } = await supabase
    .from('ordenes_compra')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
