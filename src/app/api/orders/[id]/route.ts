import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'
import { generarYEnviarComprobante } from '@/lib/pdf/generar-comprobante'
import { getYCloudApiKey } from '@/lib/tenant'
import { logAccion } from '@/lib/audit'
import { normalizarTelefono } from '@/lib/utils'

const ESTADOS_VALIDOS = ['programado', 'pendiente', 'confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado', 'entregado', 'cancelado']

// Mensajes WhatsApp al cliente según el nuevo estado
function mensajeEstado(numeroPedido: string, estado: string, nombreFerreteria: string): string | null {
  switch (estado) {
    case 'confirmado':
      return `✅ *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* ha sido *confirmado*. Estamos preparando su pedido. ¡Gracias por su preferencia! 🙏`
    case 'en_preparacion':
      return `📦 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* está siendo preparado. Le avisaremos cuando esté listo.`
    case 'listo_para_recojo':
      return `🛍️ *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* está *listo para recojo*. ¡Lo esperamos en tienda!`
    case 'enviado':
      return `🚚 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* está *en camino*. Pronto llegará a su dirección.`
    case 'entregado':
      return `🎉 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* ha sido *entregado*. Esperamos que todo sea de su agrado. ¡Hasta la próxima!`
    case 'cancelado':
      return `❌ *${nombreFerreteria}*\n\nLamentamos informarle que su pedido *${numeroPedido}* ha sido *cancelado*. Para más información contáctenos por este mismo chat.`
    case 'devuelto':
      return `🔄 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* ha sido marcado como *devuelto*.`
    default:
      return null
  }
}

// PATCH /api/orders/[id] — actualizar estado del pedido
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  if (body.estado && !ESTADOS_VALIDOS.includes(body.estado))
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  // Obtener datos de la ferretería (para mensajes WhatsApp y validación)
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('id, nombre, telefono_whatsapp, modo_asignacion_delivery')
    .eq('id', session.ferreteriaId)
    .single()
  if (!ferreteria) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Obtener estado actual del pedido antes de actualizar (para gestión de stock y validación de pago)
  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('estado, metodo_pago, estado_pago')
    .eq('id', id)
    .eq('ferreteria_id', ferreteria.id)
    .single()

  // Validar pago antes de avanzar a en_preparacion o enviado
  // Solo tarjeta/POS requiere confirmación anticipada — el resto puede cobrarse contra entrega
  if (body.estado && ['en_preparacion', 'enviado'].includes(body.estado)) {
    const metodo = pedidoActual?.metodo_pago
    const estadoPago = pedidoActual?.estado_pago
    if (metodo === 'tarjeta' && estadoPago !== 'pagado') {
      return NextResponse.json({
        error: 'Los pagos con tarjeta/POS deben confirmarse antes de preparar el pedido',
        codigo: 'PAGO_PENDIENTE',
        estado_pago: estadoPago,
      }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('pedidos')
    .update({
      estado: body.estado,
      notas: body.notas,
      ...(body.estado === 'cancelado' && body.motivo_cancelacion
        ? { motivo_cancelacion: body.motivo_cancelacion }
        : {}),
    })
    .eq('id', id)
    .eq('ferreteria_id', ferreteria.id)
    .select('*, clientes(nombre, telefono), items_pedido(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Auditoría ──────────────────────────────────────────────────────────────
  if (body.estado) {
    await logAccion({
      ferreteriaId:  session.ferreteriaId,
      usuarioId:     session.userId,
      accion:        (body.estado === 'cancelado' || body.estado === 'devuelto') ? 'cancelar_pedido' : 'cambiar_estado_pedido',
      entidad:       'pedido',
      entidadId:     id,
      detalle: {
        estado_anterior: pedidoActual?.estado ?? null,
        estado_nuevo:    body.estado,
        numero_pedido:   data.numero_pedido,
        ...(body.motivo_cancelacion ? { motivo: body.motivo_cancelacion } : {}),
      },
    })
  }

  // ── Gestión de stock ───────────────────────────────────────────────────────
  const estadoAnterior = pedidoActual?.estado
  const estadosConfirmados = ['confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado', 'entregado']

  if (estadoAnterior === 'pendiente' && estadosConfirmados.includes(body.estado)) {
    // Descontar stock al salir de pendiente hacia cualquier estado confirmado
    // (cubre el caso de saltar directo a en_preparacion, enviado o entregado)
    await supabase.rpc('reducir_stock_pedido', { p_pedido_id: id })
      .then(({ error: e }) => {
        if (e) console.error('[Stock] Error descontando stock:', e.message)
        else console.log(`[Stock] Stock descontado para pedido ${id}`)
      })
  } else if (body.estado === 'cancelado' && estadoAnterior && estadosConfirmados.includes(estadoAnterior)) {
    // Restaurar stock si se cancela un pedido que ya tenía stock descontado
    await supabase.rpc('restaurar_stock_pedido', { p_pedido_id: id })
      .then(({ error: e }) => {
        if (e) console.error('[Stock] Error restaurando stock:', e.message)
        else console.log(`[Stock] Stock restaurado para pedido ${id}`)
      })
  }

    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errFetch || !pedidoActual) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const estado = pedidoActual.estado
  const estadosConfirmados = ['confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado', 'entregado']

  // Si el pedido descontó stock y NO ha sido cancelado, debemos restaurarlo
  if (estadosConfirmados.includes(estado)) {
    await supabase.rpc('restaurar_stock_pedido', { p_pedido_id: id })
      .then(({ error: e }) => {
        if (e) console.error('[Stock] Error restaurando stock al eliminar:', e.message)
        else console.log(`[Stock] Stock restaurado al eliminar pedido ${id}`)
      })
  }

  // Eliminar el pedido (la base de datos elimina los items en cascada)
  const { error: errDelete } = await supabase
    .from('pedidos')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (errDelete) return NextResponse.json({ error: errDelete.message }, { status: 500 })

  await logAccion({
    ferreteriaId: session.ferreteriaId,
    usuarioId: session.userId,
    accion: 'eliminar_pedido',
    entidad: 'pedido',
    entidadId: id,
    detalle: { numero_pedido: pedidoActual.numero_pedido, estado_previo: estado },
  })

  return NextResponse.json({ success: true })
}
