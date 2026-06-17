/**
 * Punto de entrada único de la Agenda — lo llaman los conectores (bot, POS,
 * Ventas). Acomoda un pedido en la agenda de su vehículo y persiste la ventana.
 *
 * Factorizado: no sabe nada de WhatsApp ni de UI. Recibe siempre un cliente
 * Supabase, igual que assignment.ts / intelligence.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { seleccionarVehiculo } from '../assignment'
import { obtenerAgendaVehiculo, escribirVentana } from './repository'
import { proponerVentana, ventanaProgramada, recomputarCadena } from './ventanas'
import type { VentanaEntrega } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>

const DEFAULT_TIEMPO_BASE_MIN = 30
const DEFAULT_VENTANA_TAMANO_MIN = 30
const DEFAULT_DURACION_BLOQUE_MIN = 30

export interface ResultadoAcomodar {
  ventanaInicio: Date
  ventanaFin: Date
  origen: VentanaEntrega['origen']
  confirmada: boolean
}

interface ConfigTienda {
  tiempoBaseMin: number
  ventanaTamanoMin: number
}

async function leerConfigTienda(supabase: DB, ferreteriaId: string): Promise<ConfigTienda> {
  const { data } = await supabase
    .from('ferreterias')
    .select('delivery_tiempo_base_min, delivery_ventana_tamano_min')
    .eq('id', ferreteriaId)
    .maybeSingle()
  return {
    tiempoBaseMin: Number(data?.delivery_tiempo_base_min ?? DEFAULT_TIEMPO_BASE_MIN),
    ventanaTamanoMin: Number(data?.delivery_ventana_tamano_min ?? DEFAULT_VENTANA_TAMANO_MIN),
  }
}

/** Duración de bloque del repartidor asignado al vehículo (su promedio). */
async function leerDuracionBloque(supabase: DB, ferreteriaId: string, vehiculoId: string | null): Promise<number> {
  if (!vehiculoId) return DEFAULT_DURACION_BLOQUE_MIN
  const { data } = await supabase
    .from('repartidores')
    .select('duracion_bloque_default_min')
    .eq('ferreteria_id', ferreteriaId)
    .eq('vehiculo_actual_id', vehiculoId)
    .maybeSingle()
  return Number(data?.duracion_bloque_default_min ?? DEFAULT_DURACION_BLOQUE_MIN)
}

export interface ParamsAcomodar {
  supabase: DB
  ferreteriaId: string
  pedidoId: string
  /** Id de la entrega ya creada (crearEntrega lo devuelve). */
  entregaId?: string | null
  esProgramado?: boolean
  fechaProgramada?: Date | null
}

/**
 * Acomoda un pedido delivery en la agenda de su vehículo y escribe la ventana
 * tanto en `entregas` como en `pedidos`. Devuelve la ventana resultante.
 */
export async function acomodarPedidoEnAgenda(p: ParamsAcomodar): Promise<ResultadoAcomodar | null> {
  const { supabase, ferreteriaId, pedidoId } = p

  // 1. Resolver la entrega y su vehículo
  let entregaId = p.entregaId ?? null
  let vehiculoId: string | null = null

  if (entregaId) {
    const { data } = await supabase
      .from('entregas')
      .select('vehiculo_id')
      .eq('id', entregaId)
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()
    vehiculoId = (data?.vehiculo_id as string | null) ?? null
  } else {
    const { data } = await supabase
      .from('entregas')
      .select('id, vehiculo_id')
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()
    entregaId = (data?.id as string | null) ?? null
    vehiculoId = (data?.vehiculo_id as string | null) ?? null
  }

  if (!entregaId) {
    console.warn('[Agenda] acomodarPedidoEnAgenda: pedido sin entrega', pedidoId)
    return null
  }

  if (!vehiculoId) {
    vehiculoId = await seleccionarVehiculo(ferreteriaId, null, supabase)
    if (vehiculoId) {
      await supabase
        .from('entregas')
        .update({ vehiculo_id: vehiculoId })
        .eq('id', entregaId)
        .eq('ferreteria_id', ferreteriaId)
    }
  }

  // 2. Config + promedio del repartidor
  const { tiempoBaseMin, ventanaTamanoMin } = await leerConfigTienda(supabase, ferreteriaId)
  const duracionBloqueMin = await leerDuracionBloque(supabase, ferreteriaId, vehiculoId)

  // 3. Calcular la ventana
  let ventana: VentanaEntrega
  if (p.esProgramado && p.fechaProgramada) {
    ventana = ventanaProgramada(p.fechaProgramada, ventanaTamanoMin)
  } else {
    const bloques = vehiculoId
      ? await obtenerAgendaVehiculo(supabase, ferreteriaId, vehiculoId)
      : []
    ventana = proponerVentana({
      ahora: new Date(),
      bloquesExistentes: bloques,
      tiempoBaseMin,
      ventanaTamanoMin,
      duracionBloqueMin,
    })
  }

  // 4. Persistir (entrega + pedido)
  await escribirVentana(supabase, { entregaId, pedidoId, ferreteriaId, ventana })

  return {
    ventanaInicio: ventana.inicio,
    ventanaFin: ventana.fin,
    origen: ventana.origen,
    confirmada: ventana.confirmada,
  }
}

/**
 * Re-encadena la agenda de un vehículo tras un cambio manual (mover/confirmar/
 * agrupar): los anclados quedan fijos y los movibles se reacomodan. Persiste
 * solo los bloques que cambiaron.
 */
export async function recomputarAgendaVehiculo(
  supabase: DB,
  ferreteriaId: string,
  vehiculoId: string,
): Promise<number> {
  const { tiempoBaseMin } = await leerConfigTienda(supabase, ferreteriaId)
  const bloques = await obtenerAgendaVehiculo(supabase, ferreteriaId, vehiculoId)
  const cambios = recomputarCadena(bloques, { ahora: new Date(), tiempoBaseMin })

  for (const c of cambios) {
    const bloque = bloques.find((b) => b.entregaId === c.entregaId)
    if (!bloque) continue
    await escribirVentana(supabase, {
      entregaId: c.entregaId,
      pedidoId: bloque.pedidoId,
      ferreteriaId,
      ventana: { inicio: c.inicio, fin: c.fin, origen: bloque.ventana.origen, confirmada: bloque.ventana.confirmada },
    })
  }

  return cambios.length
}

export { formatearVentana } from './ventanas'
