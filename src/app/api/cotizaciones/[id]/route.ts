import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// PATCH /api/cotizaciones/[id] — actualizar precios de items (antes de aprobar)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  const body = await request.json()
  // body.items = [{ id, precio_unitario }]

  if (body.notas_dueno !== undefined) {
    await supabase
      .from('cotizaciones')
      .update({ notas_dueno: body.notas_dueno })
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
  }

  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (!item.id || item.precio_unitario === undefined) continue
      const precio = parseFloat(item.precio_unitario)
      if (isNaN(precio) || precio < 0) continue

      // Recalcular subtotal
      const { data: itemActual } = await supabase
        .from('items_cotizacion').select('cantidad').eq('id', item.id).single()
      if (!itemActual) continue

      await supabase
        .from('items_cotizacion')
        .update({
          precio_unitario: precio,
          subtotal: precio * itemActual.cantidad,
        })
        .eq('id', item.id)
    }
  }

  const { data } = await supabase
    .from('cotizaciones')
    .select('*, items_cotizacion(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  return NextResponse.json(data)
}

// GET /api/cotizaciones/[id]
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, clientes(nombre, telefono), items_cotizacion(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE /api/cotizaciones/[id] — eliminar cotización
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase
    .from('cotizaciones')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT /api/cotizaciones/[id] — editar cotización completa
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const {
    nombre_cliente,
    telefono_cliente,
    notas_dueno,
    items,
  } = body

  if (!nombre_cliente?.trim()) return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 })
  if (!telefono_cliente?.trim()) return NextResponse.json({ error: 'Teléfono del cliente requerido' }, { status: 400 })
  if (!items?.length) return NextResponse.json({ error: 'Debe incluir al menos un item' }, { status: 400 })

  // 1. Manejar cliente
  let clienteId: string | null = null
  const telNormal = telefono_cliente.replace(/\D/g, '')

  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('id')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('telefono', telNormal)
    .maybeSingle()

  if (clienteExistente) {
    clienteId = clienteExistente.id
    await supabase.from('clientes').update({ nombre: nombre_cliente.trim() }).eq('id', clienteId)
  } else {
    const { data: nuevoCliente, error: errCliente } = await supabase
      .from('clientes')
      .insert({
        ferreteria_id: session.ferreteriaId,
        telefono: telNormal,
        nombre: nombre_cliente.trim(),
      })
      .select('id')
      .single()

    if (errCliente || !nuevoCliente) {
      return NextResponse.json({ error: 'Error al registrar cliente' }, { status: 500 })
    }
    clienteId = nuevoCliente.id
  }

  const total = items.reduce((s: number, i: any) => s + i.cantidad * i.precio_unitario, 0)

  // 2. Actualizar cotización
  const { error: errUpdateCot } = await supabase
    .from('cotizaciones')
    .update({
      cliente_id: clienteId,
      total,
      notas_dueno: notas_dueno?.trim() || null,
    })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (errUpdateCot) return NextResponse.json({ error: errUpdateCot.message }, { status: 500 })

  // 3. Eliminar items anteriores
  await supabase
    .from('items_cotizacion')
    .delete()
    .eq('cotizacion_id', id)

  // 4. Insertar nuevos items
  const itemsInsert = items.map((i: any) => ({
    cotizacion_id: id,
    producto_id: i.producto_id,
    nombre_producto: i.nombre_producto,
    unidad: i.unidad,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    precio_original: i.precio_unitario,
    subtotal: i.cantidad * i.precio_unitario,
  }))

  const { error: errItems } = await supabase.from('items_cotizacion').insert(itemsInsert)
  if (errItems) return NextResponse.json({ error: errItems.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
