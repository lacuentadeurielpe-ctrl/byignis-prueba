/**
 * Delivery Notification Templates
 *
 * Pure functions that receive context and return formatted strings.
 * Messages are in Spanish (Peruvian casual-professional tone).
 */

import { formatearDuracion, formatearHoraLlegada } from '@/lib/delivery/eta'

export interface DeliveryTemplateContext {
  numeroPedido: string
  nombreFerreteria: string
  etaMinutos?: number
  trackingUrl?: string
  repartidorNombre?: string
  motivo?: string
  nuevaHoraLlegada?: Date
}

/** Asignado: pedido está siendo preparado */
export function templateAsignado(ctx: DeliveryTemplateContext): string {
  const eta = ctx.etaMinutos
    ? `\n⏱ ETA: *${formatearDuracion(ctx.etaMinutos)}*`
    : ''
  const repartidor = ctx.repartidorNombre
    ? `\nRepartidor: *${ctx.repartidorNombre}*`
    : ''

  return `🚚 *${ctx.nombreFerreteria}*\n\nTu pedido *${ctx.numeroPedido}* está siendo preparado para entrega.${repartidor}${eta}\n\n¡Te avisaremos cuando salga!`
}

/** En ruta: pedido está en camino */
export function templateEnRuta(ctx: DeliveryTemplateContext): string {
  const eta = ctx.etaMinutos
    ? `\n⏱ Llegada estimada: *${formatearDuracion(ctx.etaMinutos)}*`
    : ''
  const tracking = ctx.trackingUrl
    ? `\n\n📍 Sigue tu entrega en vivo:\n${ctx.trackingUrl}`
    : ''

  return `🚚 *${ctx.nombreFerreteria}*\n\n¡Tu pedido *${ctx.numeroPedido}* ya está *en camino*! 🎯${eta}${tracking}\n\n¡Prepárate para recibirlo!`
}

/** Delay: pedido con retraso */
export function templateDelay(ctx: DeliveryTemplateContext): string {
  const nuevaHora = ctx.nuevaHoraLlegada
    ? `\n🕐 Nueva hora estimada: *${formatearHoraLlegada(ctx.nuevaHoraLlegada)}*`
    : ''
  const motivo = ctx.motivo
    ? `\nMotivo: ${ctx.motivo}`
    : ''

  return `⚠️ *${ctx.nombreFerreteria}*\n\nTu pedido *${ctx.numeroPedido}* tiene un pequeño retraso.${motivo}${nuevaHora}\n\nDisculpa las molestias, estamos en eso.`
}

/** Entregado: pedido entregado exitosamente */
export function templateEntregado(ctx: DeliveryTemplateContext): string {
  return `✅ *${ctx.nombreFerreteria}*\n\n¡Tu pedido *${ctx.numeroPedido}* ha sido *entregado*! 🎉\n\n¡Gracias por tu compra! Esperamos que todo sea de tu agrado. 🙏`
}

/** Fallida: no se pudo entregar */
export function templateFallida(ctx: DeliveryTemplateContext): string {
  const motivo = ctx.motivo
    ? `\nMotivo: ${ctx.motivo}`
    : ''

  return `❌ *${ctx.nombreFerreteria}*\n\nNo pudimos entregar tu pedido *${ctx.numeroPedido}*.${motivo}\n\nPor favor contáctanos para coordinar una nueva entrega.`
}
