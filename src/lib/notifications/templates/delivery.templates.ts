/**
 * Delivery Notification Templates
 *
 * Pure functions that receive context and return formatted strings.
 * Messages are in Spanish (Peruvian casual-professional tone).
 */

import { formatearDuracion, formatearHoraLlegada } from '@/lib/delivery/eta'
import { formatearVentana } from '@/lib/delivery/agenda/ventanas'

export interface DeliveryTemplateContext {
  numeroPedido: string
  nombreFerreteria: string
  etaMinutos?: number
  /** Ventana de entrega declarada (preferida sobre etaMinutos cuando existe). */
  ventanaInicio?: Date
  ventanaFin?: Date
  trackingUrl?: string
  repartidorNombre?: string
  motivo?: string
  nuevaHoraLlegada?: Date
}

/**
 * Texto de tiempo de llegada: prefiere la ventana declarada por el repartidor;
 * si no hay ventana, cae al ETA en minutos (compatibilidad).
 */
function textoLlegada(ctx: DeliveryTemplateContext, etiqueta: string): string {
  if (ctx.ventanaInicio && ctx.ventanaFin) {
    return `\n🕐 ${etiqueta}: *${formatearVentana(ctx.ventanaInicio, ctx.ventanaFin)}*`
  }
  if (ctx.etaMinutos) {
    return `\n⏱ ${etiqueta}: *${formatearDuracion(ctx.etaMinutos)}*`
  }
  return ''
}

/** Asignado: pedido está siendo preparado */
export function templateAsignado(ctx: DeliveryTemplateContext): string {
  const llegada = textoLlegada(ctx, 'Llega entre')
  const repartidor = ctx.repartidorNombre
    ? `\nRepartidor: *${ctx.repartidorNombre}*`
    : ''

  return `🚚 *${ctx.nombreFerreteria}*\n\nTu pedido *${ctx.numeroPedido}* está siendo preparado para entrega.${repartidor}${llegada}\n\n¡Te avisaremos cuando salga!`
}

/** En ruta: pedido está en camino */
export function templateEnRuta(ctx: DeliveryTemplateContext): string {
  const llegada = textoLlegada(ctx, 'Llega entre')
  const tracking = ctx.trackingUrl
    ? `\n\n📍 Sigue tu entrega en vivo:\n${ctx.trackingUrl}`
    : ''

  return `🚚 *${ctx.nombreFerreteria}*\n\n¡Tu pedido *${ctx.numeroPedido}* ya está *en camino*! 🎯${llegada}${tracking}\n\n¡Prepárate para recibirlo!`
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
