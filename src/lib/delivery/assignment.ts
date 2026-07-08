/**
 * Asignación v2 — Motor de asignación integrado con la orquestación completa.
 *
 * Integra:
 *   - queue-engine: encolar pedido con prioridad antes de crear entrega
 *   - OSRM /table: selección del repartidor más cercano al destino
 *   - cascade-eta: ETA real considerando flota, cola, zona y tráfico
 *   - multi-stop: detecta si el repartidor ya está en ruta y agrega parada
 *   - vehiculos_delivery: specs reales (velocidad, capacidad, estado)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { encontrarRepartidorMasCercano } from './osrm'
import { encolarPedido, type ParamsEncolar } from './queue-engine'
import { calcularCascadaETA } from './cascade-eta'
import { crearMultiReparto, agregarParada, type ParadaMultiStop } from './multi-stop'
import { recalcularETAsCascada } from './cascade-eta'

// ── Selección de vehículo (usa vehiculos_delivery + estado operativo) ─────────

export async function seleccionarVehiculo(
  ferreteriaId: string,
  repartidorId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  /** Sucursal del pedido: prioriza vehículos de ese local (los sin local sirven a todos). */
  localId?: string | null,
): Promise<string | null> {
  // Prioridad 1: vehículo asignado al repartidor en este momento
  if (repartidorId) {
    const { data: rep } = await supabase
      .from('repartidores')
      .select('vehiculo_actual_id')
      .eq('id', repartidorId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (rep?.vehiculo_actual_id) return rep.vehiculo_actual_id as string
  }

  // Prioridad 2: vehículo disponible (estado = disponible | en_uso) con menos carga.
  // Con sucursal: solo vehículos de ese local o sin local asignado (flota común).
  let query = supabase
    .from('vehiculos_delivery')
    .select('id')
    .eq('ferreteria_id', ferreteriaId)
    .eq('activo', true)
    .in('estado', ['disponible', 'en_uso'])

  if (localId) query = query.or(`local_id.is.null,local_id.eq.${localId}`)

  const { data: vehiculos } = await query.order('nombre')

  if (!vehiculos?.length) return null

  const conteos = await Promise.all(
    vehiculos.map(async (v: { id: string }) => {
      const { count } = await supabase
        .from('entregas')
        .select('id', { count: 'exact', head: true })
        .eq('vehiculo_id', v.id)
        .in('estado', ['pendiente', 'carga', 'en_ruta'])

      return { id: v.id, carga: count ?? 0 }
    }),
  )

  conteos.sort((a, b) => a.carga - b.carga)
  return conteos[0]?.id ?? null
}

// ── Selección del mejor repartidor via OSRM ───────────────────────────────────

export async function seleccionarMejorRepartidor(
  ferreteriaId: string,
  clienteLat:   number,
  clienteLng:   number,
  pesoKg:       number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:     SupabaseClient<any>,
): Promise<{ repartidorId: string; vehiculoId: string | null; duracionMin: number } | null> {
  // Obtener repartidores disponibles con GPS actualizado
  const { data: repartidores } = await supabase
    .from('repartidores')
    .select('id, ultima_lat, ultima_lng, vehiculo_actual_id')
    .eq('ferreteria_id', ferreteriaId)
    .in('estado_operativo', ['disponible', 'entre_paradas'])
    .not('ultima_lat', 'is', null)
    .not('ultima_lng', 'is', null)

  if (!repartidores?.length) return null

  // Verificar que el vehículo puede con el peso
  const candidatos = await Promise.all(
    (repartidores as Array<Record<string, unknown>>).map(async (r) => {
      if (!r.vehiculo_actual_id) return null

      const { data: v } = await supabase
        .from('vehiculos_delivery')
        .select('capacidad_kg, estado')
        .eq('id', r.vehiculo_actual_id as string)
        .maybeSingle()

      if (!v) return null
      if (!['disponible', 'en_uso'].includes(v.estado as string)) return null
      if (pesoKg > 0 && (v.capacidad_kg as number) < pesoKg) return null

      return {
        id:         r.id as string,
        vehiculoId: r.vehiculo_actual_id as string,
        lat:        r.ultima_lat as number,
        lng:        r.ultima_lng as number,
      }
    }),
  )

  const candidatosFiltrados = candidatos.filter(Boolean) as Array<{
    id: string; vehiculoId: string; lat: number; lng: number
  }>

  if (!candidatosFiltrados.length) return null

  // Usar OSRM para encontrar el más cercano al destino
  try {
    const resultado = await encontrarRepartidorMasCercano(
      { lat: clienteLat, lng: clienteLng },
      candidatosFiltrados.map(c => ({
        id:     c.id,
        coords: { lat: c.lat ?? 0, lng: c.lng ?? 0 },
      })),
    )

    if (!resultado) {
      return {
        repartidorId: candidatosFiltrados[0].id,
        vehiculoId:   candidatosFiltrados[0].vehiculoId,
        duracionMin:  20,
      }
    }

    const vehiculoId = candidatosFiltrados.find(c => c.id === resultado.repartidorId)?.vehiculoId ?? null

    return {
      repartidorId: resultado.repartidorId,
      vehiculoId,
      duracionMin:  resultado.duracionMin,
    }
  } catch {
    // Fallback: primer candidato disponible
    return {
      repartidorId: candidatosFiltrados[0].id,
      vehiculoId:   candidatosFiltrados[0].vehiculoId,
      duracionMin:  20,
    }
  }
}

// ── Parámetros para crear entrega ─────────────────────────────────────────────

export interface ParamsCrearEntrega {
  ferreteriaId:      string
  pedidoId:          string
  repartidorId:      string | null
  etaMinutos:        number | null
  prioridad?:        1 | 2 | 3 | 4 | 5  // 1=urgente → 5=programado
  pesoTotalKg?:      number
  zonaDeliveryId?:   string | null
  horaProgramadaAt?: Date | null         // para pedidos programados
  multiStop?:        boolean             // agregar a ruta activa del repartidor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:          SupabaseClient<any>
}

/**
 * Crea el registro de entrega para un pedido de delivery.
 * Idempotente — si ya existe una entrega para el pedido, retorna su id sin duplicar.
 *
 * El ETA que ve el cliente lo controla el repartidor (via hora_fin_declarada).
 * El parámetro etaMinutos es solo orientativo para logística interna.
 */
export async function crearEntrega(params: ParamsCrearEntrega): Promise<string | null> {
  const {
    ferreteriaId,
    pedidoId,
    repartidorId,
    etaMinutos,
    prioridad     = 3,
    pesoTotalKg   = 0,
    zonaDeliveryId,
    horaProgramadaAt,
    multiStop     = false,
    supabase,
  } = params

  try {
    // Idempotencia: evitar duplicados
    const { data: existente } = await supabase
      .from('entregas')
      .select('id')
      .eq('pedido_id', pedidoId)
      .maybeSingle()

    if (existente) return existente.id as string

    // Sucursal del pedido: la entrega la hereda y acota la flota candidata
    const { data: pedidoRow } = await supabase
      .from('pedidos')
      .select('local_id')
      .eq('id', pedidoId)
      .single()
    const localId = (pedidoRow?.local_id as string | null) ?? null

    // ── 1. Seleccionar vehículo ──────────────────────────────────────────────
    const vehiculoId = await seleccionarVehiculo(ferreteriaId, repartidorId, supabase, localId)

    // ── 2. Encolar pedido en delivery_queue ──────────────────────────────────
    const queueParams: ParamsEncolar = {
      ferreteriaId,
      pedidoId,
      prioridad,
      pesoTotalKg,
      zonaDeliveryId:   zonaDeliveryId ?? undefined,
      repartidorPrefId: repartidorId ?? undefined,
      noAntesDe:        horaProgramadaAt ?? undefined,
    }

    try {
      await encolarPedido(queueParams, supabase)
    } catch (e) {
      console.warn('[Delivery] Error encolando pedido (continúa):', e)
    }

    // ── 3. ETA orientativo (el ETA real lo declara el repartidor) ───────────
    const etaFinal = etaMinutos
    const etaTimestamp: string | null = etaMinutos
      ? new Date(Date.now() + etaMinutos * 60_000).toISOString()
      : null

    // ── 4. Crear registro de entrega ─────────────────────────────────────────
    const { data: entrega, error } = await supabase
      .from('entregas')
      .insert({
        ferreteria_id:         ferreteriaId,
        pedido_id:             pedidoId,
        vehiculo_id:           vehiculoId,
        repartidor_id:         repartidorId,
        estado:                'pendiente',
        eta_inicial:           etaTimestamp,
        eta_actual:            etaTimestamp,
        duracion_estimada_min: etaFinal,
        eta_calculado_at:      new Date().toISOString(),
        orden_en_ruta:         1,
        prioridad,
        intentos_entrega:      0,
        max_intentos:          3,
        peso_total_kg:         pesoTotalKg,
        local_id:              localId,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Delivery] Error creando entrega:', error.message)
      return null
    }

    const entregaId = entrega?.id as string | null
    if (!entregaId) return null

    // ── 5. Si multi-stop, agregar a ruta activa del repartidor ───────────────
    if (multiStop && repartidorId) {
      try {
        await integrarEnRutaMultiStop(
          entregaId, pedidoId, ferreteriaId, repartidorId, pesoTotalKg, supabase,
        )
      } catch (e) {
        console.warn('[Delivery] No se pudo agregar a ruta multi-stop:', e)
      }
    }

    // ── 6. Actualizar queue item con entrega_id ──────────────────────────────
    await supabase
      .from('delivery_queue')
      .update({ entrega_id: entregaId })
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .eq('estado', 'esperando')

    return entregaId
  } catch (e) {
    console.error('[Delivery] crearEntrega exception:', e)
    return null
  }
}

// ── Integración con ruta multi-stop del repartidor ────────────────────────────

async function integrarEnRutaMultiStop(
  entregaId:    string,
  pedidoId:     string,
  ferreteriaId: string,
  repartidorId: string,
  pesoKg:       number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:     SupabaseClient<any>,
): Promise<void> {
  // ¿El repartidor tiene un multi_reparto activo?
  const { data: multiActivo } = await supabase
    .from('multi_repartos')
    .select('id')
    .eq('ferreteria_id', ferreteriaId)
    .eq('repartidor_id', repartidorId)
    .eq('estado', 'activo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!multiActivo) return

  // Obtener coordenadas del pedido
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('cliente_lat, cliente_lng, ferreterias!inner(lat, lng)')
    .eq('id', pedidoId)
    .single()

  if (!pedido?.cliente_lat) return

  const nuevaParada: ParadaMultiStop = {
    entregaId,
    pedidoId,
    clienteLat: pedido.cliente_lat as number,
    clienteLng: pedido.cliente_lng as number,
    pesoKg,
  }

  const ferrRow2 = Array.isArray(pedido.ferreterias)
    ? (pedido.ferreterias[0] as { lat?: number; lng?: number } | undefined)
    : (pedido.ferreterias as { lat?: number; lng?: number } | null)

  await agregarParada(
    multiActivo.id as string,
    nuevaParada,
    ferreteriaId,
    ferrRow2?.lat ?? 0,
    ferrRow2?.lng ?? 0,
    supabase,
  )
}

// ── Crear ruta multi-stop para varios pedidos a la vez ────────────────────────

export async function crearRutaMultiStop(params: {
  ferreteriaId:  string
  repartidorId:  string
  vehiculoId:    string | null
  pedidoIds:     string[]
  planificadoPara?: Date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:      SupabaseClient<any>
}): Promise<string | null> {
  const { ferreteriaId, repartidorId, vehiculoId, pedidoIds, supabase } = params

  if (!pedidoIds.length) return null

  try {
    // Obtener coords de todos los pedidos
    const { data: ferreteria } = await supabase
      .from('ferreterias')
      .select('lat, lng')
      .eq('id', ferreteriaId)
      .single()

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, cliente_lat, cliente_lng')
      .in('id', pedidoIds)
      .eq('ferreteria_id', ferreteriaId)
      .not('cliente_lat', 'is', null)

    if (!pedidos?.length || !ferreteria?.lat) return null

    // Obtener entrega_id para cada pedido
    const { data: entregas } = await supabase
      .from('entregas')
      .select('id, pedido_id, peso_total_kg')
      .in('pedido_id', pedidoIds)
      .eq('ferreteria_id', ferreteriaId)

    const entregaMap = new Map(
      (entregas ?? []).map((e: Record<string, unknown>) => [e.pedido_id as string, e])
    )

    const paradas: ParadaMultiStop[] = (pedidos as Array<Record<string, unknown>>)
      .filter(p => entregaMap.has(p.id as string))
      .map(p => {
        const e = entregaMap.get(p.id as string)!
        return {
          entregaId:  e.id as string,
          pedidoId:   p.id as string,
          clienteLat: p.cliente_lat as number,
          clienteLng: p.cliente_lng as number,
          pesoKg:     (e.peso_total_kg as number) ?? 0,
        }
      })

    if (!paradas.length) return null

    const resultado = await crearMultiReparto({
      ferreteriaId,
      repartidorId,
      vehiculoId,
      paradas,
      ferreteriaLat:   ferreteria.lat as number,
      ferreteriaLng:   ferreteria.lng as number,
      planificadoPara: params.planificadoPara,
    }, supabase)

    // Marcar repartidor como en_ruta
    await supabase
      .from('repartidores')
      .update({ estado_operativo: 'en_ruta' })
      .eq('id', repartidorId)
      .eq('ferreteria_id', ferreteriaId)

    return resultado.multiRepartoId
  } catch (e) {
    console.error('[Delivery] crearRutaMultiStop error:', e)
    return null
  }
}

// ── Recalculador de ETAs en cascada (reemplaza recalcularETAsCola) ────────────

/**
 * Recalcula los ETAs de TODOS los pedidos delivery pendientes de la ferretería.
 * Usa cascade-eta para considerar estado de vehículos, repartidores, zona y tráfico.
 * Fallback: si cascade-eta falla para algún pedido, lo omite sin error.
 */
export async function recalcularETAsCola(
  ferreteriaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  try {
    await recalcularETAsCascada(ferreteriaId, supabase)
  } catch (e) {
    console.error('[Delivery] recalcularETAsCola (cascade) error:', e)
  }
}
