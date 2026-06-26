/**
 * Delivery Notifications — High-level functions
 *
 * Each function:
 *   1. Builds the template with context
 *   2. Inserts a delivery_events row
 *   3. Calls dispatcher.broadcast() (sends via all active channels)
 *   4. Updates the event with channels that succeeded
 *
 * Anti-spam: 30 min cooldown between same notification type for same entrega.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeliveryNotificationContext, DeliveryEventType } from './types'
import { createDispatcher } from './dispatcher'
import {
  templateAsignado,
  templateEnRuta,
  templateDelay,
  templateEntregado,
  templateFallida,
} from './templates/delivery.templates'

const COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

// ── Anti-spam check ──────────────────────────────────────────────────────────

async function canNotify(
  entregaId: string,
  evento: DeliveryEventType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()
    const { data } = await supabase
      .from('delivery_events')
      .select('id')
      .eq('entrega_id', entregaId)
      .eq('evento', evento)
      .gte('created_at', cutoff)
      .limit(1)

    return !data?.length
  } catch {
    return true // fail open
  }
}

// ── Core send helper ─────────────────────────────────────────────────────────

async function sendDeliveryNotification(
  ctx: DeliveryNotificationContext,
  evento: DeliveryEventType,
  message: string,
  detalle: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  // Anti-spam
  const allowed = await canNotify(ctx.entregaId, evento, supabase)
  if (!allowed) {
    console.log(`[Notifications] Cooldown active for ${evento} on entrega ${ctx.entregaId}`)
    return
  }

  // Insert event first
  const { data: eventRow } = await supabase
    .from('delivery_events')
    .insert({
      ferreteria_id: ctx.ferreteriaId,
      entrega_id: ctx.entregaId,
      evento,
      detalle,
    })
    .select('id')
    .single()

  // Send via all available channels
  const dispatcher = createDispatcher()
  const results = await dispatcher.broadcast(
    {
      to: ctx.telefonoCliente,
      from: ctx.telefonoWhatsapp,
      message,
      metadata: { apiKey: ctx.apiKey, sender: ctx.sender },
    },
    {
      ferreteriaId: ctx.ferreteriaId,
      telefonoWhatsapp: ctx.telefonoWhatsapp,
      apiKey: ctx.apiKey,
      sender: ctx.sender,
    },
  )

  // Update event with channels that succeeded
  const canalesEnviados = results
    .filter(r => r.success)
    .map(r => r.channelId)

  if (eventRow?.id) {
    await supabase
      .from('delivery_events')
      .update({
        canales_enviados: canalesEnviados,
        notificado_at: canalesEnviados.length > 0 ? new Date().toISOString() : null,
      })
      .eq('id', eventRow.id)
  }

  // Log failures
  const failures = results.filter(r => !r.success)
  if (failures.length > 0) {
    console.warn('[Notifications] Some channels failed:', failures.map(f => `${f.channelId}: ${f.error}`))
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function notificarAsignacion(
  ctx: DeliveryNotificationContext,
  etaMinutos: number | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  etaTimestamp?: Date | null,
): Promise<void> {
  const message = templateAsignado({
    numeroPedido: ctx.numeroPedido,
    nombreFerreteria: ctx.nombreFerreteria,
    etaMinutos: etaMinutos ?? undefined,
    etaTimestamp: etaTimestamp ?? undefined,
    repartidorNombre: ctx.repartidorNombre,
  })

  await sendDeliveryNotification(ctx, 'asignado', message, {
    eta_minutos: etaMinutos,
    eta_timestamp: etaTimestamp?.toISOString() ?? null,
    repartidor: ctx.repartidorNombre,
  }, supabase)
}

export async function notificarEnRuta(
  ctx: DeliveryNotificationContext,
  etaMinutos: number | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  etaTimestamp?: Date | null,
): Promise<void> {
  const message = templateEnRuta({
    numeroPedido: ctx.numeroPedido,
    nombreFerreteria: ctx.nombreFerreteria,
    etaMinutos: etaMinutos ?? undefined,
    etaTimestamp: etaTimestamp ?? undefined,
    trackingUrl: ctx.trackingUrl,
  })

  await sendDeliveryNotification(ctx, 'en_ruta', message, {
    eta_minutos: etaMinutos,
    eta_timestamp: etaTimestamp?.toISOString() ?? null,
    tracking_url: ctx.trackingUrl,
  }, supabase)
}

export async function notificarDelay(
  ctx: DeliveryNotificationContext,
  nuevoEtaMin: number,
  motivo: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  const nuevaHora = new Date(Date.now() + nuevoEtaMin * 60_000)
  const message = templateDelay({
    numeroPedido: ctx.numeroPedido,
    nombreFerreteria: ctx.nombreFerreteria,
    etaMinutos: nuevoEtaMin,
    nuevaHoraLlegada: nuevaHora,
    motivo: motivo ?? undefined,
  })

  await sendDeliveryNotification(ctx, 'delay', message, {
    nuevo_eta_min: nuevoEtaMin,
    nueva_hora: nuevaHora.toISOString(),
    motivo,
  }, supabase)
}

export async function notificarEntregado(
  ctx: DeliveryNotificationContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  const message = templateEntregado({
    numeroPedido: ctx.numeroPedido,
    nombreFerreteria: ctx.nombreFerreteria,
  })

  await sendDeliveryNotification(ctx, 'entregado', message, {}, supabase)
}

export async function notificarFallida(
  ctx: DeliveryNotificationContext,
  motivo: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  const message = templateFallida({
    numeroPedido: ctx.numeroPedido,
    nombreFerreteria: ctx.nombreFerreteria,
    motivo: motivo ?? undefined,
  })

  await sendDeliveryNotification(ctx, 'fallida', message, {
    motivo,
  }, supabase)
}
