/**
 * ETA simple: el repartidor es la autoridad.
 *
 * Regla: ETA próximo pedido = max(hora_fin_declarada de entregas activas) + tiempoBase
 * Si no hay entregas activas con hora declarada: ETA = ahora + tiempoBase
 * tiempoBase viene de ferreterias.delivery_tiempo_base_min (default 30 min)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>

const ESTADOS_TERMINALES = ['entregado', 'cancelado', 'fallida', 'rechazado', 'devuelto']

async function obtenerTiempoBase(supabase: DB, ferreteriaId: string): Promise<number> {
  const { data } = await supabase
    .from('ferreterias')
    .select('delivery_tiempo_base_min')
    .eq('id', ferreteriaId)
    .maybeSingle()
  return (data?.delivery_tiempo_base_min as number | null) ?? 30
}

/**
 * Calcula el ETA para un pedido nuevo:
 * - Si hay entregas activas con hora_fin_declarada futura: max(hora_fin_declarada) + tiempoBase
 * - Si no hay ninguna (primer pedido del día o vehículo libre): ahora + tiempoBase
 *
 * @param vehiculoId  Si se pasa, filtra por ese vehículo; si no, toma toda la flota.
 */
export async function calcularETANuevoPedido(
  supabase: DB,
  ferreteriaId: string,
  vehiculoId?: string | null,
): Promise<{ eta: Date; etaMinutos: number }> {
  const tiempoBaseMin = await obtenerTiempoBase(supabase, ferreteriaId)
  const ahora = Date.now()

  let query = supabase
    .from('entregas')
    .select('hora_fin_declarada')
    .eq('ferreteria_id', ferreteriaId)
    .not('hora_fin_declarada', 'is', null)
    .not('estado', 'in', `(${ESTADOS_TERMINALES.join(',')})`)
    .gt('hora_fin_declarada', new Date(ahora).toISOString()) // solo fins futuros

  if (vehiculoId) {
    query = query.eq('vehiculo_id', vehiculoId)
  }

  const { data } = await query

  let etaDate: Date
  if (data?.length) {
    const maxFin = Math.max(
      ...data.map((e: { hora_fin_declarada: string }) => new Date(e.hora_fin_declarada).getTime()),
    )
    etaDate = new Date(maxFin + tiempoBaseMin * 60_000)
  } else {
    // Primer pedido del día (o vehículo ocioso): ahora + tiempoBase
    etaDate = new Date(ahora + tiempoBaseMin * 60_000)
  }

  const etaMinutos = Math.max(1, Math.round((etaDate.getTime() - ahora) / 60_000))
  return { eta: etaDate, etaMinutos }
}

/**
 * El repartidor declara la hora en que calcula que terminará una entrega.
 * Se guarda en entregas.hora_fin_declarada y se espeja en pedidos.eta_timestamp
 * para que Ventas, el bot y Conversaciones la lean sin JOIN.
 */
export async function declararHoraFin(
  supabase: DB,
  entregaId: string,
  pedidoId: string,
  ferreteriaId: string,
  horaFin: Date,
): Promise<void> {
  const iso = horaFin.toISOString()

  await supabase
    .from('entregas')
    .update({ hora_fin_declarada: iso })
    .eq('id', entregaId)
    .eq('ferreteria_id', ferreteriaId)

  await supabase
    .from('pedidos')
    .update({ eta_timestamp: iso })
    .eq('id', pedidoId)
    .eq('ferreteria_id', ferreteriaId)
}

/** "1:30 pm" en horario Lima */
export function formatearETA(eta: Date): string {
  return eta
    .toLocaleTimeString('es-PE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Lima',
    })
    .replace(/\s*a\.?\s*m\.?/i, ' am')
    .replace(/\s*p\.?\s*m\.?/i, ' pm')
    .trim()
}

/** Igual que formatearETA pero acepta ISO string; null si falta */
export function formatearETADesdeISO(iso?: string | null): string | null {
  if (!iso) return null
  return formatearETA(new Date(iso))
}
