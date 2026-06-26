/**
 * POST /api/delivery/cola/[pedidoId]/asignar
 *
 * El dueño/vendedor asigna un repartidor a un pedido en cola.
 * Si el pedido ya tiene una entrega creada → actualiza el repartidor.
 * Si no tiene entrega → crea una nueva con el repartidor.
 *
 * Después de asignar: notifica al cliente por WhatsApp (asignación confirmada).
 * También dispara el evento Inngest check-delay para monitorear la entrega.
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'
import { notificarAsignacion } from '@/lib/notifications/delivery.notifications'
import { resolverSender } from '@/lib/whatsapp/provider'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { pedidoId } = await params
  const body = await request.json()
  const { repartidor_id } = body

  if (!repartidor_id) {
    return NextResponse.json({ error: 'repartidor_id requerido' }, { status: 400 })
  }

  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  // Verificar que el pedido pertenece a esta ferretería y está en cola
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, modalidad, eta_minutos, telefono_cliente, nombre_cliente')
    .eq('id', pedidoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (!['confirmado', 'en_preparacion', 'listo_para_recojo'].includes(pedido.estado)) {
    return NextResponse.json({ error: 'El pedido no está en estado asignable' }, { status: 400 })
  }

  // Verificar que el repartidor pertenece a esta ferretería y está activo
  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, nombre, token, vehiculos_delivery(id, nombre)')
    .eq('id', repartidor_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Repartidor no encontrado o inactivo' }, { status: 404 })

  // Ver si ya existe una entrega para este pedido
  const { data: entregaExistente } = await supabase
    .from('entregas')
    .select('id, repartidor_id, estado')
    .eq('pedido_id', pedidoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .maybeSingle()

  let entregaId: string

  if (entregaExistente) {
    // Actualizar entrega existente con el nuevo repartidor
    const { data: updatedEntrega, error } = await supabaseAdmin
      .from('entregas')
      .update({
        repartidor_id,
        estado: 'asignado',
      })
      .eq('id', entregaExistente.id)
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    entregaId = updatedEntrega.id
  } else {
    // Crear nueva entrega
    const { data: nuevaEntrega, error } = await supabaseAdmin
      .from('entregas')
      .insert({
        ferreteria_id: session.ferreteriaId,
        pedido_id: pedidoId,
        repartidor_id,
        estado: 'asignado',
        duracion_estimada_min: pedido.eta_minutos,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    entregaId = nuevaEntrega.id
  }

  // Actualizar pedido con repartidor asignado
  await supabaseAdmin
    .from('pedidos')
    .update({ repartidor_id })
    .eq('id', pedidoId)
    .eq('ferreteria_id', session.ferreteriaId)

  // ── Notificar al cliente que su pedido fue asignado ──────────────────────
  try {
    const { data: ferreteria } = await supabase
      .from('ferreterias')
      .select('nombre, telefono_whatsapp')
      .eq('id', session.ferreteriaId)
      .single()

    if (ferreteria?.telefono_whatsapp && pedido.telefono_cliente) {
      const sender = await resolverSender(supabaseAdmin, session.ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
      if (sender) {
        await notificarAsignacion(
          {
            ferreteriaId: session.ferreteriaId,
            entregaId,
            pedidoId,
            numeroPedido: pedido.numero_pedido as string,
            nombreFerreteria: (ferreteria.nombre as string) ?? '',
            telefonoWhatsapp: (ferreteria.telefono_whatsapp as string).replace(/^\+/, ''),
            telefonoCliente: pedido.telefono_cliente as string,
            sender,
            repartidorNombre: repartidor.nombre as string,
          },
          pedido.eta_minutos as number | null,
          supabaseAdmin,
        )
      }
    }
  } catch (e) {
    console.error('[Cola/Asignar] Error notificando cliente:', e)
  }

  // ── Disparar Inngest check-delay si tiene ETA ────────────────────────────
  if (pedido.eta_minutos) {
    try {
      await inngest.send({
        name: 'delivery/eta.updated',
        data: {
          ferreteriaId: session.ferreteriaId,
          pedidoId,
          etaMinutos: pedido.eta_minutos as number,
          source: 'asignacion_manual',
        },
      })
    } catch (e) {
      console.error('[Cola/Asignar] Error enviando evento Inngest:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    entregaId,
    repartidorNombre: repartidor.nombre,
    message: `Pedido ${pedido.numero_pedido} asignado a ${repartidor.nombre}`,
  })
}
