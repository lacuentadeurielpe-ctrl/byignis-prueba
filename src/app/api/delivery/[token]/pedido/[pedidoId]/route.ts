// PATCH /api/delivery/[token]/pedido/[pedidoId]
// Acciones que puede ejecutar el repartidor sobre un pedido:
//   entregado      — confirma entrega con cobro, actualiza estado_pago
//   cambiar_estado — solo permite: confirmado/en_preparacion → enviado
//   incidencia     — registra un problema sin cambiar estado
//   retorno        — devuelve el pedido a tienda
//   emergencia     — solo notifica al dueño por WhatsApp
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'
import { getYCloudApiKey } from '@/lib/tenant'
import { recalcularETAsCola } from '@/lib/delivery/assignment'
import { completarPrediccion } from '@/lib/delivery/intelligence'
import {
  notificarEnRuta,
  notificarEntregado,
  notificarFallida,
} from '@/lib/notifications/delivery.notifications'
import type { DeliveryNotificationContext } from '@/lib/notifications/types'
import { inngest } from '@/lib/inngest/client'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string; pedidoId: string }> }
) {
  const { token, pedidoId } = await params
  const supabase = adminClient()

  // Autenticar repartidor por token — TENANT AISLADO
  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, nombre, ferreteria_id, puede_registrar_deuda, ferreterias(nombre, telefono_whatsapp, telefono_dueno)')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await request.json()
  const { accion, cobrado_monto, cobrado_metodo, incidencia_tipo, incidencia_desc, mensaje_emergencia, nuevo_estado } = body

  const ACCIONES_VALIDAS = ['entregado', 'cambiar_estado', 'incidencia', 'retorno', 'emergencia']
  if (!ACCIONES_VALIDAS.includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  // Cargar pedido — filtrado por ferreteria_id (TENANT AISLADO)
  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, estado_pago, total, monto_pagado, cobrado_monto, cliente_id, telefono_cliente, eta_minutos, clientes(telefono)')
    .eq('id', pedidoId)
    .eq('ferreteria_id', repartidor.ferreteria_id)   // TENANT AISLADO
    .single()

  if (!pedidoActual) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const ferr = repartidor.ferreterias as any

  // ── Emergencia: solo notifica, no toca el pedido ──────────────────────────
  if (accion === 'emergencia') {
    if (ferr?.telefono_whatsapp && ferr?.telefono_dueno) {
      const msg = `🚨 *EMERGENCIA — ${ferr.nombre}*\n\nRepartidor: *${repartidor.nombre}*\nPedido: *${pedidoActual.numero_pedido}*\n\n${mensaje_emergencia ?? 'Sin detalles adicionales.'}`
      getYCloudApiKey(repartidor.ferreteria_id).then((apiKey) => {
        if (apiKey) {
          enviarMensaje({ from: ferr.telefono_whatsapp.replace(/^\+/, ''), to: ferr.telefono_dueno, texto: msg, apiKey })
            .catch((e) => console.error('[Delivery] Error enviando emergencia:', e))
        }
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, mensaje: 'Emergencia reportada al dueño' })
  }

  const update: Record<string, unknown> = {}

  // ── Cambiar estado (en ruta / en preparación) ─────────────────────────────
  if (accion === 'cambiar_estado') {
    const ESTADOS_PERMITIDOS = ['enviado'] // el repartidor solo puede marcar "en camino"
    if (!ESTADOS_PERMITIDOS.includes(nuevo_estado)) {
      return NextResponse.json({ error: 'Estado no permitido para repartidor' }, { status: 400 })
    }
    update.estado = nuevo_estado
  }

  // ── Entregado: confirmar entrega + registrar cobro + actualizar estado_pago ──
  if (accion === 'entregado') {
    update.estado = 'entregado'
    update.cobrado_monto = cobrado_monto ?? null
    update.cobrado_metodo = cobrado_metodo ?? null

    const montoCobrado      = typeof cobrado_monto === 'number' ? cobrado_monto : parseFloat(cobrado_monto ?? '0') || 0
    const totalPedido       = pedidoActual.total ?? 0
    // Considerar lo que ya pagó el cliente por WhatsApp/Yape antes de la entrega
    const montoPagadoPrevio = pedidoActual.monto_pagado ?? 0
    const saldoPendiente    = Math.max(0, totalPedido - montoPagadoPrevio)

    // Solo procesar cobro si el pedido aún no estaba pagado
    if (pedidoActual.estado_pago !== 'pagado') {
      if (saldoPendiente === 0 || montoCobrado >= saldoPendiente) {
        // Cubre el saldo pendiente completo → pagado
        update.estado_pago         = 'pagado'
        update.monto_pagado        = totalPedido   // marca como totalmente cubierto
        update.pago_confirmado_at  = new Date().toISOString()
        update.pago_confirmado_por = repartidor.id   // UUID del repartidor
        update.metodo_pago         = cobrado_metodo ?? null
      } else if (montoCobrado > 0 && montoCobrado < saldoPendiente) {
        // Pago parcial del saldo restante — requiere permiso del repartidor
        if (!repartidor.puede_registrar_deuda) {
          return NextResponse.json({
            error: 'No tienes permiso para registrar cobros parciales. Consulta con el encargado.',
            code: 'sin_permiso_deuda',
          }, { status: 403 })
        }

        // Verificar límite de crédito del CLIENTE (no del repartidor)
        const deudaGenerada = saldoPendiente - montoCobrado
        const clienteId = (pedidoActual as any).cliente_id

        if (clienteId) {
          const { data: cliente } = await supabase
            .from('clientes')
            .select('limite_credito_monto')
            .eq('id', clienteId)
            .single()

          const limiteMonto = (cliente as any)?.limite_credito_monto ?? null

          if (limiteMonto !== null) {
            // Sumar deudas activas y vencidas actuales del cliente
            const { data: deudasActivas } = await supabase
              .from('creditos')
              .select('monto_total, monto_pagado')
              .eq('cliente_id', clienteId)
              .in('estado', ['activo', 'vencido'])

            const deudaActual = (deudasActivas ?? []).reduce(
              (s: number, d: any) => s + Math.max(0, d.monto_total - d.monto_pagado), 0
            )
            const creditoDisponible = Math.max(0, limiteMonto - deudaActual)

            if (deudaGenerada > creditoDisponible) {
              return NextResponse.json({
                error: creditoDisponible <= 0
                  ? `Este cliente no puede recibir más crédito. Ya tiene S/ ${deudaActual.toFixed(2)} de deuda (límite: S/ ${Number(limiteMonto).toFixed(2)}). Comunícate con el encargado.`
                  : `El crédito disponible del cliente es S/ ${creditoDisponible.toFixed(2)}, pero la deuda que se generaría es S/ ${deudaGenerada.toFixed(2)}. Debes cobrar al menos S/ ${(saldoPendiente - creditoDisponible).toFixed(2)}.`,
                code: 'limite_cliente_excedido',
                credito_disponible: creditoDisponible,
                deuda_generada: deudaGenerada,
              }, { status: 403 })
            }
          }
        }

        update.estado_pago  = 'credito_activo'
        update.monto_pagado = montoPagadoPrevio + montoCobrado   // acumular pagos
      }
      // montoCobrado === 0 → deja estado_pago como está (pendiente)
    }
  }

  // ── Incidencia ────────────────────────────────────────────────────────────
  if (accion === 'incidencia') {
    update.incidencia_tipo = incidencia_tipo ?? 'otro'
    update.incidencia_desc = incidencia_desc ?? null
  }

  // ── Retorno: vuelve a tienda, se desasigna ────────────────────────────────
  if (accion === 'retorno') {
    update.estado       = 'en_preparacion'
    update.repartidor_id = null
    update.incidencia_tipo = incidencia_tipo ?? 'otro'
    update.incidencia_desc = incidencia_desc ?? 'Pedido retornado a tienda'
  }

  // Guardar cambios en pedido — TENANT AISLADO (doble filtro)
  const { data, error } = await supabase
    .from('pedidos')
    .update(update)
    .eq('id', pedidoId)
    .eq('ferreteria_id', repartidor.ferreteria_id)   // TENANT AISLADO
    .select('id, estado, estado_pago, numero_pedido')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Sincronizar estado de la entrega ─────────────────────────────────────────
  let entregaIdParaTracking: string | null = null

  if (accion === 'cambiar_estado' && nuevo_estado === 'enviado') {
    // Pedido salió → entrega en_ruta + timestamp; recuperar id para link de tracking
    const { data: entSync, error: e } = await supabase
      .from('entregas')
      .update({ estado: 'en_ruta', salio_at: new Date().toISOString() })
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', repartidor.ferreteria_id)   // TENANT AISLADO
      .select('id')
      .single()
    if (e) console.error('[Delivery] Error sync entrega en_ruta:', e.message)
    else entregaIdParaTracking = entSync?.id ?? null
  }

  if (accion === 'entregado') {
    // Calcular duración real (desde salio_at) + completar predicción IA
    supabase
      .from('entregas')
      .select('id, salio_at')
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', repartidor.ferreteria_id)
      .maybeSingle()
      .then(({ data: ent }) => {
        const duracionReal = ent?.salio_at
          ? Math.round((Date.now() - new Date(ent.salio_at).getTime()) / 60_000)
          : null
        supabase
          .from('entregas')
          .update({
            estado:            'entregado',
            llego_at:          new Date().toISOString(),
            ...(duracionReal != null && { duracion_real_min: duracionReal }),
          })
          .eq('pedido_id', pedidoId)
          .eq('ferreteria_id', repartidor.ferreteria_id)
          .then(({ error: e }) => { if (e) console.error('[Delivery] Error sync entrega entregado:', e.message) })

        // Backfill prediction with real duration for ML training
        if (ent?.id && duracionReal != null) {
          completarPrediccion(ent.id as string, duracionReal, repartidor.ferreteria_id, supabase)
            .catch(e => console.error('[Delivery] Error completando predicción:', e))
        }
      })
  }

  if (accion === 'retorno') {
    supabase
      .from('entregas')
      .update({ estado: 'fallida' })
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', repartidor.ferreteria_id)
      .then(({ error: e }) => { if (e) console.error('[Delivery] Error sync entrega retorno:', e.message) })
  }

  // ── Recalcular ETAs de la cola cuando la cola se reduce ───────────────────
  // entregado y retorno liberan una posición → los demás pedidos ganan tiempo.
  if (accion === 'entregado' || accion === 'retorno') {
    recalcularETAsCola(repartidor.ferreteria_id, supabase)
      .catch((e) => console.error('[Delivery] recalcularETAsCola error:', e))

    // Disparar Inngest para notificar al dueño sobre capacidad liberada
    inngest.send({
      name: 'delivery/cola.changed',
      data: {
        ferreteriaId: repartidor.ferreteria_id,
        motivo: accion === 'entregado' ? 'entregado' : 'retorno',
        pedidoId,
      },
    }).catch((e) => console.error('[Delivery] Error enviando evento cola.changed:', e))
  }

  // ── Si fue pago parcial → crear registro de crédito/deuda ─────────────────
  if (accion === 'entregado' && update.estado_pago === 'credito_activo') {
    const montoCobrado      = typeof cobrado_monto === 'number' ? cobrado_monto : parseFloat(cobrado_monto ?? '0') || 0
    const totalPedido       = pedidoActual.total ?? 0
    const montoPagadoPrevio = pedidoActual.monto_pagado ?? 0
    const saldoPendiente    = Math.max(0, totalPedido - montoPagadoPrevio)
    const deuda             = saldoPendiente - montoCobrado   // lo que quedó sin cubrir

    if (deuda > 0) {
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() + 30)

      const notasDeuda = montoPagadoPrevio > 0
        ? `Deuda por entrega parcial. Total: S/${totalPedido.toFixed(2)} — Pagado prev. (digital): S/${montoPagadoPrevio.toFixed(2)} — Cobrado por repartidor: S/${montoCobrado.toFixed(2)} — Saldo: S/${deuda.toFixed(2)}. Repartidor: ${repartidor.nombre}`
        : `Deuda por entrega parcial. Cobrado: S/${montoCobrado.toFixed(2)} de S/${totalPedido.toFixed(2)}. Repartidor: ${repartidor.nombre}`

      supabase.from('creditos').insert({
        ferreteria_id: repartidor.ferreteria_id,          // TENANT AISLADO
        cliente_id:    (pedidoActual as any).cliente_id ?? null,   // vincular cliente real
        pedido_id:     pedidoId,
        monto_total:   deuda,
        monto_pagado:  0,
        fecha_limite:  fechaLimite.toISOString().slice(0, 10),
        estado:        'activo',
        notas:         notasDeuda,
        aprobado_por:  `repartidor:${repartidor.nombre}`,
      }).then(({ error: errCred }) => {
        if (errCred) console.error('[Delivery] Error creando crédito:', errCred.message)
      })
    }
  }

  // ── Notificaciones multi-canal + WhatsApp legacy (fire-and-forget) ──────────
  if (ferr?.telefono_whatsapp) {
    getYCloudApiKey(repartidor.ferreteria_id).then((apiKey) => {
      if (!apiKey) return
      const from = ferr.telefono_whatsapp.replace(/^\+/, '')
      const telefono = (pedidoActual.clientes as any)?.telefono ?? pedidoActual.telefono_cliente
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

      // Build notification context for multi-channel dispatch
      const notifCtx: DeliveryNotificationContext = {
        ferreteriaId: repartidor.ferreteria_id,
        entregaId: entregaIdParaTracking ?? '',
        pedidoId,
        numeroPedido: pedidoActual.numero_pedido as string,
        nombreFerreteria: ferr.nombre ?? '',
        telefonoWhatsapp: from,
        telefonoCliente: telefono ?? '',
        apiKey,
        trackingUrl: entregaIdParaTracking ? `${appUrl}/tracking/${entregaIdParaTracking}` : undefined,
        repartidorNombre: repartidor.nombre as string,
      }

      // ── "En camino" — multi-channel notification + Inngest delay detector ──
      if (accion === 'cambiar_estado' && nuevo_estado === 'enviado' && telefono) {
        const etaMin = (pedidoActual as any).eta_minutos as number | null
        notificarEnRuta(notifCtx, etaMin, supabase)
          .catch(e => console.error('[Delivery] Error notif en_ruta:', e))

        // Disparar Inngest para detectar retraso si ETA existe
        if (etaMin && etaMin > 0) {
          inngest.send({
            name: 'delivery/pedido.enviado',
            data: {
              ferreteriaId: repartidor.ferreteria_id,
              pedidoId,
              entregaId: entregaIdParaTracking ?? '',
              numeroPedido: (pedidoActual as any).numero_pedido as string,
              etaMinutos: etaMin,
              telefonoCliente: telefono,
              telefonoWhatsapp: from,
              nombreFerreteria: ferr?.nombre ?? '',
              repartidorNombre: repartidor.nombre as string,
            },
          }).catch(e => console.error('[Delivery] Error enviando evento pedido.enviado:', e))
        }
      }

      // ── "Entregado" — multi-channel notification ──────────────────────────
      if (accion === 'entregado' && telefono) {
        notificarEntregado(notifCtx, supabase)
          .catch(e => console.error('[Delivery] Error notif entregado:', e))
      }

      // ── "Retorno/Fallida" — multi-channel notification to client ──────────
      if (accion === 'retorno' && telefono) {
        const motivo = incidencia_desc ?? 'Pedido retornado a tienda'
        notificarFallida(notifCtx, motivo, supabase)
          .catch(e => console.error('[Delivery] Error notif fallida:', e))
      }

      // ── Incidencia/retorno — notify OWNER via WhatsApp (direct) ───────────
      if ((accion === 'incidencia' || accion === 'retorno') && ferr?.telefono_dueno) {
        const labelInc: Record<string, string> = {
          cliente_ausente:   'Cliente no estaba',
          pedido_incorrecto: 'Pedido incorrecto',
          pago_rechazado:    'No pudo pagar',
          otro:              'Otro problema',
        }
        const tipoLabel = labelInc[incidencia_tipo ?? 'otro'] ?? incidencia_tipo ?? 'Problema'
        const emoji  = accion === 'retorno' ? '🔄' : '⚠️'
        const titulo = accion === 'retorno' ? 'RETORNO' : 'INCIDENCIA'
        enviarMensaje({
          from, to: ferr.telefono_dueno,
          texto: `${emoji} *${titulo} — ${ferr.nombre}*\n\nRepartidor: *${repartidor.nombre}*\nPedido: *${pedidoActual.numero_pedido}*\nProblema: ${tipoLabel}${incidencia_desc ? `\nDetalle: ${incidencia_desc}` : ''}`,
          apiKey,
        }).catch((e) => console.error('[Delivery] Error notificando incidencia al dueño:', e))
      }
    }).catch(() => {})
  }

  return NextResponse.json(data)
}
