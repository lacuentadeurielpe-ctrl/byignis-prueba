/**
 * GET  /api/delivery/queue  — Obtener cola completa o filtrada
 * POST /api/delivery/queue  — Encolar nuevo pedido
 * PATCH /api/delivery/queue — Cambiar prioridad de un item
 * DELETE /api/delivery/queue — Cancelar item de la cola
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import {
  obtenerCola,
  encolarPedido,
  actualizarEstadoCola,
  cancelarEnCola,
  type EstadoCola,
} from '@/lib/delivery/queue-engine'

export async function GET(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const soloActivos = searchParams.get('activos') === 'true'

  const supabase = await createClient()
  const cola = await obtenerCola(session.ferreteriaId, supabase)

  const filtrada = soloActivos
    ? cola.filter(i => ['esperando', 'asignado', 'en_ruta', 'bloqueado', 'reagendado'].includes(i.estado))
    : cola

  return NextResponse.json({ items: filtrada, total: filtrada.length })
}

export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as {
    pedido_id:         string
    prioridad?:        1 | 2 | 3 | 4 | 5
    peso_total_kg?:    number
    zona_delivery_id?: string
    hora_programada?:  string  // ISO
  }

  if (!body.pedido_id) return NextResponse.json({ error: 'pedido_id requerido' }, { status: 400 })

  const supabase = await createClient()
  const resultado = await encolarPedido({
    ferreteriaId:    session.ferreteriaId,
    pedidoId:        body.pedido_id,
    prioridad:       body.prioridad  ?? 3,
    pesoTotalKg:     body.peso_total_kg ?? 0,
    zonaDeliveryId:  body.zona_delivery_id,
    noAntesDe:       body.hora_programada ? new Date(body.hora_programada) : undefined,
  }, supabase)

  return NextResponse.json({ ok: true, ...resultado })
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as {
    item_id:    string
    prioridad?: 1 | 2 | 3 | 4 | 5
    estado?:    EstadoCola
  }

  if (!body.item_id) return NextResponse.json({ error: 'item_id requerido' }, { status: 400 })

  const supabase = await createClient()

  // Si solo cambia prioridad
  if (body.prioridad) {
    const { error } = await supabase
      .from('delivery_queue')
      .update({ prioridad: body.prioridad })
      .eq('id', body.item_id)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Si cambia estado
  if (body.estado) {
    await actualizarEstadoCola(body.item_id, body.estado, supabase)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as { item_id: string }
  if (!body.item_id) return NextResponse.json({ error: 'item_id requerido' }, { status: 400 })

  // Obtener pedido_id del item
  const supabase = await createClient()
  const { data: item } = await supabase
    .from('delivery_queue')
    .select('pedido_id')
    .eq('id', body.item_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!item) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })

  await cancelarEnCola(item.pedido_id as string, session.ferreteriaId, supabase)

  return NextResponse.json({ ok: true })
}
