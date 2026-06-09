/**
 * POST /api/delivery/reprogramar
 * Reprograma un pedido para una nueva fecha/hora de entrega.
 *
 * Casos de uso:
 *   - Dueño reprograma manualmente desde el dashboard
 *   - Inngest `cliente-ausente.ts` lo llama automáticamente tras agotar intentos
 *   - QueueManager lo llama desde la UI
 *
 * Body:
 *   {
 *     pedido_id:         string   — requerido
 *     nueva_fecha:       string   — ISO datetime (en Lima UTC-5)
 *     motivo?:           string   — para el log
 *     notificar_cliente?: boolean — enviar WhatsApp al cliente (default true)
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as {
    pedido_id:          string
    nueva_fecha:        string   // ISO string
    motivo?:            string
    notificar_cliente?: boolean
  }

  if (!body.pedido_id)  return NextResponse.json({ error: 'pedido_id requerido' }, { status: 400 })
  if (!body.nueva_fecha) return NextResponse.json({ error: 'nueva_fecha requerida' }, { status: 400 })

  const nuevaFecha = new Date(body.nueva_fecha)
  if (isNaN(nuevaFecha.getTime())) {
    return NextResponse.json({ error: 'nueva_fecha inválida — debe ser ISO datetime' }, { status: 400 })
  }

  const supabase = await createClient()

  // Cargar pedido
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, telefono_cliente, cliente_id, clientes(telefono)')
    .eq('id', body.pedido_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  // Actualizar fecha programada en pedido
  const { error: pedidoError } = await supabase
    .from('pedidos')
    .update({
      reprogramado_para: nuevaFecha.toISOString(),
      reprogramado_at:    new Date().toISOString(),
      reprogramado_motivo: body.motivo ?? 'Reprogramado desde dashboard',
    })
    .eq('id', body.pedido_id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (pedidoError) return NextResponse.json({ error: pedidoError.message }, { status: 500 })

  // Actualizar en queue
  await supabase
    .from('delivery_queue')
    .update({
      no_antes_de: nuevaFecha.toISOString(),
      estado:      'reagendado',
    })
    .eq('pedido_id', body.pedido_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .not('estado', 'in', '("completado","cancelado","fallido_definitivo")')

  // Actualizar en entregas activas
  await supabase
    .from('entregas')
    .update({ reagendado_para: nuevaFecha.toISOString(), reagendado_motivo: body.motivo ?? 'Reprogramado desde dashboard' })
    .eq('pedido_id', body.pedido_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .not('estado', 'in', '("entregado","cancelado","fallida")')

  // Log de operaciones
  const supabaseAdmin = createAdminClient()
  await supabaseAdmin.from('delivery_operaciones_log').insert({
    ferreteria_id: session.ferreteriaId,
    tipo_evento:   'pedido_reprogramado',
    entidad_tipo:  'pedido',
    entidad_id:    body.pedido_id,
    detalle: {
      nueva_fecha:    nuevaFecha.toISOString(),
      motivo:         body.motivo ?? 'Reprogramado desde dashboard',
      numero_pedido:  (pedido as any).numero_pedido,
      reprogramado_por: session.userId,
    },
    origen:   'dashboard',
    resuelto: false,
  })

  // Disparar workflow de pedido programado para la nueva fecha
  await inngest.send({
    name: 'delivery/pedido.programado',
    data: {
      ferreteriaId:    session.ferreteriaId,
      pedidoId:        body.pedido_id,
      horaProgramadaAt: nuevaFecha.toISOString(),
      notificarCliente: body.notificar_cliente !== false,
    },
  })

  // Hora en Lima para mostrar al usuario
  const horaLima = nuevaFecha.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day:      '2-digit',
    month:    'short',
    hour:     '2-digit',
    minute:   '2-digit',
  })

  return NextResponse.json({
    ok:         true,
    pedidoId:   body.pedido_id,
    nuevaFecha: nuevaFecha.toISOString(),
    horaLima,
    mensaje:    `Pedido ${(pedido as any).numero_pedido} reprogramado para ${horaLima}`,
  })
}
