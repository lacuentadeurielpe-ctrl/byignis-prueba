/**
 * Multi-Stop — Rutas de múltiples paradas
 *
 * Permite que un repartidor lleve N pedidos en un solo tramo.
 * Usa OSRM /trip para el orden óptimo de visita.
 * Cuando se cancela una parada intermedia, rehace la ruta automáticamente.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { optimizarRutaOSRM, calcularRuta, type Coords } from './osrm'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParadaMultiStop {
  entregaId:   string
  pedidoId:    string
  clienteLat:  number
  clienteLng:  number
  pesoKg?:     number
  direccion?:  string
}

export interface ResultadoMultiStop {
  multiRepartoId:   string
  orden:            Array<{
    entregaId:        string
    pedidoId:         string
    posicion:         number   // 1-indexed
    etaAcumuladaMin:  number
    distanciaLegKm:   number
  }>
  distanciaTotalKm: number
  duracionTotalMin: number
  polyline:         string | null
  pesoTotalKg:      number
}

// ── Crear multi-reparto ───────────────────────────────────────────────────────

export async function crearMultiReparto(
  params: {
    ferreteriaId:  string
    repartidorId:  string | null
    vehiculoId:    string | null
    paradas:       ParadaMultiStop[]
    ferreteriaLat: number
    ferreteriaLng: number
    planificadoPara?: Date
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<ResultadoMultiStop> {
  const { ferreteriaId, repartidorId, vehiculoId, paradas } = params

  if (paradas.length === 0) throw new Error('Multi-reparto requiere al menos una parada')

  const origen: Coords = { lat: params.ferreteriaLat, lng: params.ferreteriaLng }

  // Calcular ruta optimizada con OSRM
  const trip = await optimizarRutaOSRM(
    origen,
    paradas.map(p => ({ id: p.entregaId, coords: { lat: p.clienteLat, lng: p.clienteLng } })),
  )

  const pesoTotal = paradas.reduce((sum, p) => sum + (p.pesoKg ?? 0), 0)

  // Construir orden de paradas
  const ordenParadas = trip.paradas.map(tp => {
    const parada = paradas[tp.indiceOriginal]
    return {
      entrega_id:       parada.entregaId,
      orden:            tp.orden + 1,
      eta_min:          tp.etaAcumuladaMin,
      distancia_km:     tp.distanciaKm,
    }
  })

  // Insertar en multi_repartos
  const { data: mr, error } = await supabase
    .from('multi_repartos')
    .insert({
      ferreteria_id:     ferreteriaId,
      repartidor_id:     repartidorId,
      vehiculo_id:       vehiculoId,
      estado:            'planificado',
      orden_paradas:     ordenParadas,
      distancia_total_km: trip.distanciaKm,
      duracion_total_min: trip.duracionMin,
      ruta_polyline:     trip.polyline,
      peso_total_kg:     pesoTotal,
      planificado_para:  params.planificadoPara?.toISOString() ?? null,
    })
    .select('id')
    .single()

  if (error || !mr) throw new Error(`[MultiStop] Error creando multi_reparto: ${error?.message}`)

  const multiRepartoId = mr.id as string

  // Vincular entregas al multi_reparto y asignar orden
  await Promise.all(
    trip.paradas.map(async tp => {
      const parada = paradas[tp.indiceOriginal]
      await supabase.from('entregas').update({
        multi_reparto_id: multiRepartoId,
        posicion_ruta:    tp.orden + 1,
        orden_en_ruta:    tp.orden + 1,
        eta_calculado_at: new Date().toISOString(),
        duracion_estimada_min: tp.etaAcumuladaMin,
        distancia_osrm_km: tp.distanciaKm,
      })
      .eq('id', parada.entregaId)
      .eq('ferreteria_id', ferreteriaId)
    }),
  )

  return {
    multiRepartoId,
    orden: trip.paradas.map(tp => {
      const parada = paradas[tp.indiceOriginal]
      return {
        entregaId:       parada.entregaId,
        pedidoId:        parada.pedidoId,
        posicion:        tp.orden + 1,
        etaAcumuladaMin: tp.etaAcumuladaMin,
        distanciaLegKm:  tp.distanciaKm,
      }
    }),
    distanciaTotalKm: trip.distanciaKm,
    duracionTotalMin: trip.duracionMin,
    polyline:         trip.polyline,
    pesoTotalKg:      pesoTotal,
  }
}

// ── Agregar parada a multi-reparto activo ─────────────────────────────────────

export async function agregarParada(
  multiRepartoId: string,
  nuevaParada:    ParadaMultiStop,
  ferreteriaId:   string,
  ferreteriaLat:  number,
  ferreteriaLng:  number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:       SupabaseClient<any>,
): Promise<ResultadoMultiStop> {
  // Obtener paradas actuales
  const { data: mr } = await supabase
    .from('multi_repartos')
    .select('orden_paradas, repartidor_id, vehiculo_id')
    .eq('id', multiRepartoId)
    .eq('ferreteria_id', ferreteriaId)
    .single()

  if (!mr) throw new Error('Multi-reparto no encontrado')

  const paradasActuales: Array<{ entrega_id: string; orden: number; eta_min: number }> =
    (mr.orden_paradas as Array<Record<string, unknown>>).map(p => ({
      entrega_id: p.entrega_id as string,
      orden:      p.orden as number,
      eta_min:    p.eta_min as number,
    }))

  // Obtener coords de entregas actuales
  const { data: entregasActuales } = await supabase
    .from('entregas')
    .select('id, pedido_id, pedidos!inner(cliente_lat, cliente_lng)')
    .in('id', paradasActuales.map(p => p.entrega_id))

  const todasParadas: ParadaMultiStop[] = [
    ...(entregasActuales ?? []).map((e: Record<string, unknown>) => {
      const p = e.pedidos as Record<string, unknown>
      return {
        entregaId:  e.id as string,
        pedidoId:   (e as Record<string, unknown>).pedido_id as string,
        clienteLat: p.cliente_lat as number,
        clienteLng: p.cliente_lng as number,
      }
    }),
    nuevaParada,
  ]

  // Recalcular ruta completa
  return crearMultiReparto({
    ferreteriaId,
    repartidorId: mr.repartidor_id as string | null,
    vehiculoId:   mr.vehiculo_id   as string | null,
    paradas:      todasParadas,
    ferreteriaLat,
    ferreteriaLng,
  }, supabase).then(async resultado => {
    // Actualizar el ID del multi_reparto (reusar el mismo)
    await supabase.from('multi_repartos').delete().eq('id', resultado.multiRepartoId)
    return resultado
  })
}

// ── Eliminar parada (cancelación en ruta) ─────────────────────────────────────

/**
 * Cuando se cancela un pedido que está en una ruta multi-parada,
 * elimina esa parada y reoptimiza la ruta con los puntos restantes.
 */
export async function eliminarParada(
  multiRepartoId:  string,
  entregaIdCancelar: string,
  ferreteriaId:    string,
  ferreteriaLat:   number,
  ferreteriaLng:   number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:        SupabaseClient<any>,
  repartidorLatActual?: number,  // posición actual del repartidor
  repartidorLngActual?: number,
): Promise<ResultadoMultiStop | null> {
  const { data: mr } = await supabase
    .from('multi_repartos')
    .select('orden_paradas, repartidor_id, vehiculo_id')
    .eq('id', multiRepartoId)
    .eq('ferreteria_id', ferreteriaId)
    .single()

  if (!mr) return null

  const paradasActuales = (mr.orden_paradas as Array<Record<string, unknown>>)
    .filter(p => p.entrega_id !== entregaIdCancelar)

  if (paradasActuales.length === 0) {
    // Sin paradas restantes — cerrar el multi_reparto
    await supabase.from('multi_repartos').update({ estado: 'cancelado' }).eq('id', multiRepartoId)
    await supabase.from('entregas').update({
      multi_reparto_id: null, posicion_ruta: null,
    }).eq('multi_reparto_id', multiRepartoId)
    return null
  }

  // Desvincular la parada cancelada
  await supabase.from('entregas').update({ multi_reparto_id: null, posicion_ruta: null })
    .eq('id', entregaIdCancelar).eq('ferreteria_id', ferreteriaId)

  // Obtener coords de las paradas restantes
  const { data: entregasRestantes } = await supabase
    .from('entregas')
    .select('id, pedido_id, pedidos!inner(cliente_lat, cliente_lng)')
    .in('id', paradasActuales.map(p => p.entrega_id as string))

  if (!entregasRestantes?.length) return null

  const paradas: ParadaMultiStop[] = (entregasRestantes as Record<string, unknown>[]).map(e => {
    const p = e.pedidos as Record<string, unknown>
    return {
      entregaId:  e.id as string,
      pedidoId:   e.pedido_id as string,
      clienteLat: p.cliente_lat as number,
      clienteLng: p.cliente_lng as number,
    }
  })

  // Si el repartidor ya salió, usar su posición actual como origen
  const origen: Coords = repartidorLatActual && repartidorLngActual
    ? { lat: repartidorLatActual, lng: repartidorLngActual }
    : { lat: ferreteriaLat, lng: ferreteriaLng }

  const trip = await optimizarRutaOSRM(origen, paradas.map(p => ({
    id: p.entregaId, coords: { lat: p.clienteLat, lng: p.clienteLng },
  })))

  // Actualizar multi_reparto con nueva ruta
  const nuevoOrden = trip.paradas.map(tp => ({
    entrega_id:  paradas[tp.indiceOriginal].entregaId,
    orden:       tp.orden + 1,
    eta_min:     tp.etaAcumuladaMin,
    distancia_km: tp.distanciaKm,
  }))

  await supabase.from('multi_repartos').update({
    orden_paradas:      nuevoOrden,
    distancia_total_km: trip.distanciaKm,
    duracion_total_min: trip.duracionMin,
    ruta_polyline:      trip.polyline,
    updated_at:         new Date().toISOString(),
  }).eq('id', multiRepartoId)

  // Actualizar posiciones de entregas restantes
  await Promise.all(trip.paradas.map(async tp => {
    const parada = paradas[tp.indiceOriginal]
    await supabase.from('entregas').update({
      posicion_ruta:        tp.orden + 1,
      orden_en_ruta:        tp.orden + 1,
      duracion_estimada_min: tp.etaAcumuladaMin,
    }).eq('id', parada.entregaId).eq('ferreteria_id', ferreteriaId)
  }))

  return {
    multiRepartoId,
    orden: trip.paradas.map(tp => ({
      entregaId:       paradas[tp.indiceOriginal].entregaId,
      pedidoId:        paradas[tp.indiceOriginal].pedidoId,
      posicion:        tp.orden + 1,
      etaAcumuladaMin: tp.etaAcumuladaMin,
      distanciaLegKm:  tp.distanciaKm,
    })),
    distanciaTotalKm: trip.distanciaKm,
    duracionTotalMin: trip.duracionMin,
    polyline:         trip.polyline,
    pesoTotalKg:      0,
  }
}

// ── ETA desde posición actual del repartidor ─────────────────────────────────

/**
 * Recalcula el ETA de la siguiente parada basándose en la posición
 * GPS actual del repartidor (no desde la ferretería).
 */
export async function etaDesdeGPS(
  repartidorCoords:  Coords,
  siguienteParadaCoords: Coords,
  velocidadKmh = 30,
): Promise<{ duracionMin: number; distanciaKm: number }> {
  try {
    const ruta = await calcularRuta(repartidorCoords, siguienteParadaCoords, velocidadKmh)
    return { duracionMin: ruta.duracionMin, distanciaKm: ruta.distanciaKm }
  } catch {
    return { duracionMin: 15, distanciaKm: 2 }
  }
}
