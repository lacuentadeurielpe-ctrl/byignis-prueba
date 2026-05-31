import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'
import { generarYEnviarComprobante } from '@/lib/pdf/generar-comprobante'
import { getYCloudApiKey } from '@/lib/tenant'
import { logAccion } from '@/lib/audit'
import { normalizarTelefono } from '@/lib/utils'

const ESTADOS_VALIDOS = ['programado', 'pendiente', 'confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado', 'devuelto']

// Mensajes WhatsApp al cliente según el nuevo estado
function mensajeEstado(numeroPedido: string, estado: string, nombreFerreteria: string): string | null {
  switch (estado) {
    case 'confirmado':
      return `✅ *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* ha sido *confirmado*. Estamos preparando su pedido. ¡Gracias por su preferencia! 🙏`
    case 'en_preparacion':
      return `📦 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* está siendo preparado. Le avisaremos cuando esté listo.`
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

  // Enviar notificación WhatsApp al cliente si el estado lo amerita
  if (body.estado) {
    const msg = mensajeEstado(data.numero_pedido, body.estado, ferreteria.nombre)
    const telefono = (data.clientes as any)?.telefono ?? data.telefono_cliente

    if (msg && telefono) {
      try {
        const apiKey = await getYCloudApiKey(ferreteria.id)
        if (apiKey) {
          await enviarMensaje({
            from: ferreteria.telefono_whatsapp.replace(/^\+/, ''),
            to: telefono,
            texto: msg,
            apiKey,
          })
        }
      } catch (e) {
        console.error('[API] Error enviando notificación de estado:', e)
        // No fallar — el estado ya se actualizó
      }
    }
  }

  // Modo libre: notificar a todos los repartidores activos con teléfono al confirmar
  if (body.estado === 'confirmado' && data.modalidad === 'delivery' && (ferreteria as any).modo_asignacion_delivery === 'libre') {
    const { data: repartidores } = await supabase
      .from('repartidores')
      .select('id, nombre, telefono, token')
      .eq('ferreteria_id', ferreteria.id)
      .eq('activo', true)
      .not('telefono', 'is', null)

    if (repartidores?.length) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      const zona = (data as any).zonas_delivery?.nombre ?? null
      const nombre = (data.clientes as any)?.nombre ?? data.nombre_cliente ?? 'Cliente'

      // Fire-and-forget — no bloquear la respuesta
      getYCloudApiKey(ferreteria.id).then((apiKey) => {
        if (!apiKey) return
        for (const rep of repartidores) {
          const msg = `🚚 *Nuevo pedido disponible — ${ferreteria.nombre}*\n\nPedido: *${data.numero_pedido}*\nCliente: ${nombre}${zona ? `\nZona: ${zona}` : ''}\nTotal: S/ ${data.total.toFixed(2)}\n\n👉 Entra a tu app para aceptarlo:\n${baseUrl}/delivery/${rep.token}`
          enviarMensaje({
            from: ferreteria.telefono_whatsapp.replace(/^\+/, ''),
            to: rep.telefono!,
            texto: msg,
            apiKey,
          }).catch((e) => console.error(`[ModoLibre] Error notificando a ${rep.nombre}:`, e))
        }
      }).catch(() => {})
    }
  }

  // Generar y enviar comprobante automáticamente al confirmar el pedido
  if (body.estado === 'confirmado') {
    getYCloudApiKey(ferreteria.id).then((ycloudApiKey) => {
      generarYEnviarComprobante({
        pedidoId: id,
        ferreteriaId: ferreteria.id,
        ycloudApiKey,
      }).catch((err) => {
        console.error('[Comprobante] Error generando automáticamente:', err)
      })
    }).catch(() => {})
  }

  return NextResponse.json(data)
}

// GET /api/orders/[id]
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, clientes(nombre, telefono), zonas_delivery(nombre), items_pedido(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// ── Interfaces para PUT ──────────────────────────────────────────────────────
interface ItemEditado {
  producto_id: string | null
  nombre_producto: string
  unidad: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
}

// PUT /api/orders/[id] — editar pedido (solo si no hay comprobante SUNAT emitido)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const {
    nombre_cliente,
    telefono_cliente,
    modalidad,
    direccion_entrega,
    zona_delivery_id,
    notas,
    items,
  }: {
    nombre_cliente: string
    telefono_cliente: string
    modalidad: 'delivery' | 'recojo'
    direccion_entrega?: string | null
    zona_delivery_id?: string
    notas?: string | null
    items: ItemEditado[]
  } = body

  // Validaciones básicas
  if (!nombre_cliente?.trim()) return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 })
  if (!telefono_cliente?.trim()) return NextResponse.json({ error: 'Teléfono del cliente requerido' }, { status: 400 })
  if (!modalidad) return NextResponse.json({ error: 'Modalidad requerida' }, { status: 400 })
  if (!items?.length) return NextResponse.json({ error: 'Debe incluir al menos un item' }, { status: 400 })
  if (modalidad === 'delivery' && !direccion_entrega?.trim())
    return NextResponse.json({ error: 'Dirección requerida para delivery' }, { status: 400 })

  // Obtener pedido actual y verificar que pertenece a esta ferretería
  const { data: pedidoActual, error: errPedido } = await supabase
    .from('pedidos')
    .select('id, ferreteria_id, estado_pago, estado, numero_pedido, cliente_id')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errPedido || !pedidoActual)
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  // Bloquear edición si el pago ya fue confirmado (pre-requisito de boleta/factura SUNAT)
  if (pedidoActual.estado_pago === 'pagado') {
    return NextResponse.json({
      error: 'No se puede editar un pedido con pago confirmado. Para modificarlo, primero anula el comprobante SUNAT si ya fue emitido.',
      codigo: 'PAGO_CONFIRMADO',
    }, { status: 400 })
  }

  // Calcular totales
  const total = items.reduce((s: number, i: ItemEditado) => s + i.cantidad * i.precio_unitario, 0)
  const costo_total = items.reduce((s: number, i: ItemEditado) => s + i.cantidad * i.costo_unitario, 0)

  // Buscar o actualizar cliente
  const telefonoNormalizado = normalizarTelefono(telefono_cliente)
  let clienteId: string | null = pedidoActual.cliente_id ?? null

  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('id')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('telefono', telefonoNormalizado)
    .maybeSingle()

  if (clienteExistente) {
    clienteId = clienteExistente.id
    await supabase
      .from('clientes')
      .update({ nombre: nombre_cliente.trim() })
      .eq('id', clienteId)
  } else {
    // Nuevo teléfono — crear cliente
    const { data: nuevoCliente } = await supabase
      .from('clientes')
      .insert({
        ferreteria_id: session.ferreteriaId,
        telefono: telefonoNormalizado,
        nombre: nombre_cliente.trim(),
      })
      .select('id')
      .single()
    if (nuevoCliente) clienteId = nuevoCliente.id
  }

  // Actualizar pedido
  const { error: errUpdate } = await supabase
    .from('pedidos')
    .update({
      nombre_cliente:   nombre_cliente.trim(),
      telefono_cliente: telefonoNormalizado,
      cliente_id:       clienteId,
      modalidad,
      direccion_entrega: modalidad === 'delivery' ? (direccion_entrega?.trim() ?? null) : null,
      zona_delivery_id:  modalidad === 'delivery' && zona_delivery_id ? zona_delivery_id : null,
      notas:            notas?.trim() ?? null,
      total,
      costo_total,
    })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (errUpdate)
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })

  // Reemplazar items: borrar los anteriores e insertar los nuevos
  const { error: errDelItems } = await supabase
    .from('items_pedido')
    .delete()
    .eq('pedido_id', id)

  if (errDelItems)
    return NextResponse.json({ error: 'Error eliminando items anteriores: ' + errDelItems.message }, { status: 500 })

  const itemsInsert = items.map((i: ItemEditado) => ({
    pedido_id:       id,
    producto_id:     i.producto_id,
    nombre_producto: i.nombre_producto,
    unidad:          i.unidad,
    cantidad:        i.cantidad,
    precio_unitario: i.precio_unitario,
    costo_unitario:  i.costo_unitario,
    subtotal:        i.cantidad * i.precio_unitario,
  }))

  const { error: errItems } = await supabase.from('items_pedido').insert(itemsInsert)
  if (errItems)
    return NextResponse.json({ error: 'Error insertando nuevos items: ' + errItems.message }, { status: 500 })

  // Auditoría
  await logAccion({
    ferreteriaId: session.ferreteriaId,
    usuarioId:    session.userId,
    accion:       'editar_pedido',
    entidad:      'pedido',
    entidadId:    id,
    detalle: {
      numero_pedido: pedidoActual.numero_pedido,
      total_nuevo:   total,
      items_count:   items.length,
    },
  })

  return NextResponse.json({ id, total, costo_total, items_count: items.length })
}
