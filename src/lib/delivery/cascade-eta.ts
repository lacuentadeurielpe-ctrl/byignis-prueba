/**
 * Cascade ETA — Árbol de dependencias para calcular ETA real
 *
 * El ETA no es una fórmula simple. Es el resultado de resolver
 * un árbol de bloqueos en cadena:
 *
 *   ETA_final = max(
 *     cuando_disponible_vehiculo,
 *     cuando_disponible_repartidor,
 *     hora_programada_pedido,
 *     ahora
 *   ) + tiempo_ruta_OSRM + penalizaciones_zona + penalizacion_peso
 *
 * Si el único vehículo está averiado con reparación estimada en 45min,
 * el ETA del siguiente pedido NO es 15min — es 45min + 15min = 60min.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularRuta, type Coords } from './osrm'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BloqueoActivo {
  tipo:        'vehiculo_averia' | 'repartidor_no_disponible' | 'sin_recursos' | 'pedido_programado'
  descripcion: string
  resolucionEstimadaAt: Date | null  // null = indeterminado
  impactoMinutos: number             // minutos de retraso por este bloqueo
}

export interface ResultadoCascadaETA {
  etaMinutos:      number
  distanciaKm:     number
  disponibleDesde: Date          // cuándo puede salir (tras resolver bloqueos)
  bloqueos:        BloqueoActivo[]
  hayBloqueos:     boolean
  fuente:          'osrm' | 'haversine' | 'sin_ruta'
  detalleCalculo:  {
    tiempoBloqueoMin:    number
    tiempoRutaMin:       number
    penalizacionZonaMin: number
    penalizacionPesoMin: number
    penalizacionColaMin: number
  }
}

export interface ParamsCascadaETA {
  ferreteriaId:    string
  ferreteriaCoords: Coords
  clienteCoords:   Coords | null     // null si no hay coordenadas del cliente
  pedidoId?:       string
  zonaDeliveryId?: string | null
  pesoTotalKg?:    number
  horaProgramadaAt?: Date | null     // si es pedido programado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:        SupabaseClient<any>
}

// Horas pico Lima (multiplicadores de tráfico)
const HORAS_PICO: Record<number, number> = {
  7: 1.3, 8: 1.4, 9: 1.3,
  12: 1.2, 13: 1.25, 14: 1.15,
  17: 1.35, 18: 1.45, 19: 1.4, 20: 1.25,
}

function horaLima(): number {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false }),
  )
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function calcularCascadaETA(
  params: ParamsCascadaETA,
): Promise<ResultadoCascadaETA> {
  const { ferreteriaId, ferreteriaCoords, clienteCoords, supabase } = params
  const ahora = new Date()
  const bloqueos: BloqueoActivo[] = []

  // ── 1. Verificar vehículos disponibles ──────────────────────────────────────
  const { data: vehiculos } = await supabase
    .from('vehiculos_delivery')
    .select('id, estado, velocidad_kmh, capacidad_kg, est_resolucion_at, descripcion_averia')
    .eq('ferreteria_id', ferreteriaId)
    .eq('activo', true)
    .order('estado')  // disponibles primero

  const vehiculosDisponibles = (vehiculos ?? []).filter(
    (v: Record<string, unknown>) => v.estado === 'disponible'
  )
  const vehiculosEnUso = (vehiculos ?? []).filter(
    (v: Record<string, unknown>) => v.estado === 'en_uso'
  )
  const vehiculosAveriados = (vehiculos ?? []).filter(
    (v: Record<string, unknown>) => ['averia_leve', 'averia_grave'].includes(v.estado as string)
  )

  let vehiculoDisponibleDesde = ahora
  let velocidadKmh = 30
  let capacidadKg  = 150

  if (vehiculosDisponibles.length > 0) {
    // Hay vehículo disponible ahora mismo
    const v = vehiculosDisponibles[0] as Record<string, unknown>
    velocidadKmh = (v.velocidad_kmh as number) ?? 30
    capacidadKg  = (v.capacidad_kg  as number) ?? 150
  } else if (vehiculosEnUso.length > 0) {
    // Todos en uso — estimar cuándo termina el más próximo a completar entrega
    const { data: entregasActivas } = await supabase
      .from('entregas')
      .select('vehiculo_id, eta_actual, duracion_estimada_min, salio_at')
      .eq('ferreteria_id', ferreteriaId)
      .in('estado', ['en_ruta', 'pendiente', 'asignado'])
      .order('eta_actual', { ascending: true })
      .limit(1)

    if (entregasActivas?.[0]?.eta_actual) {
      vehiculoDisponibleDesde = new Date(entregasActivas[0].eta_actual as string)
      const impactoMin = Math.ceil((vehiculoDisponibleDesde.getTime() - ahora.getTime()) / 60_000)
      if (impactoMin > 2) {
        bloqueos.push({
          tipo:        'repartidor_no_disponible',
          descripcion: `Todos los vehículos están en ruta. El próximo estará libre en ~${impactoMin} min`,
          resolucionEstimadaAt: vehiculoDisponibleDesde,
          impactoMinutos: impactoMin,
        })
      }
    }
    const v = vehiculosEnUso[0] as Record<string, unknown>
    velocidadKmh = (v.velocidad_kmh as number) ?? 30
    capacidadKg  = (v.capacidad_kg  as number) ?? 150
  } else if (vehiculosAveriados.length > 0 && (vehiculos?.length ?? 0) > 0) {
    // Todos los vehículos averiados
    let mejorResolucion: Date | null = null
    let impactoTotal = 9999

    for (const v of vehiculosAveriados as Record<string, unknown>[]) {
      const estRes = v.est_resolucion_at ? new Date(v.est_resolucion_at as string) : null
      if (estRes && (!mejorResolucion || estRes < mejorResolucion)) {
        mejorResolucion = estRes
        impactoTotal = Math.ceil((estRes.getTime() - ahora.getTime()) / 60_000)
      }
    }

    bloqueos.push({
      tipo:        'vehiculo_averia',
      descripcion: mejorResolucion
        ? `Vehículos en avería. Estimado disponible en ~${impactoTotal} min`
        : 'Vehículos en avería. Tiempo de resolución indeterminado — contactar encargado',
      resolucionEstimadaAt: mejorResolucion,
      impactoMinutos: mejorResolucion ? impactoTotal : 120,  // 2h default si indeterminado
    })

    vehiculoDisponibleDesde = mejorResolucion ?? new Date(ahora.getTime() + 120 * 60_000)
  } else if (!vehiculos?.length) {
    // Sin vehículos configurados
    bloqueos.push({
      tipo:        'sin_recursos',
      descripcion: 'No hay vehículos de delivery configurados',
      resolucionEstimadaAt: null,
      impactoMinutos: 60,
    })
    vehiculoDisponibleDesde = new Date(ahora.getTime() + 60 * 60_000)
  }

  // ── 2. Verificar repartidores disponibles ───────────────────────────────────
  const { data: repartidores } = await supabase
    .from('repartidores')
    .select('id, estado_operativo, disponible_desde')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'activo')

  const repsDisponibles = (repartidores ?? []).filter(
    (r: Record<string, unknown>) =>
      ['disponible', 'entre_paradas'].includes(r.estado_operativo as string)
  )

  let repartidorDisponibleDesde = ahora

  if (!repsDisponibles.length && (repartidores?.length ?? 0) > 0) {
    // Buscar el que esté libre más pronto
    const { data: entregasReps } = await supabase
      .from('entregas')
      .select('repartidor_id, eta_actual')
      .eq('ferreteria_id', ferreteriaId)
      .in('estado', ['en_ruta', 'pendiente'])
      .order('eta_actual', { ascending: true })
      .limit(1)

    if (entregasReps?.[0]?.eta_actual) {
      repartidorDisponibleDesde = new Date(entregasReps[0].eta_actual as string)
      const impactoMin = Math.ceil((repartidorDisponibleDesde.getTime() - ahora.getTime()) / 60_000)
      if (impactoMin > 2) {
        bloqueos.push({
          tipo:        'repartidor_no_disponible',
          descripcion: `Todos los repartidores están en ruta. El próximo estará libre en ~${impactoMin} min`,
          resolucionEstimadaAt: repartidorDisponibleDesde,
          impactoMinutos: impactoMin,
        })
      }
    }
  } else if (!repartidores?.length) {
    bloqueos.push({
      tipo:        'sin_recursos',
      descripcion: 'No hay repartidores activos configurados',
      resolucionEstimadaAt: null,
      impactoMinutos: 60,
    })
    repartidorDisponibleDesde = new Date(ahora.getTime() + 60 * 60_000)
  }

  // ── 3. Pedido programado ────────────────────────────────────────────────────
  let pedidoProgramadoDesde = ahora
  if (params.horaProgramadaAt && params.horaProgramadaAt > ahora) {
    pedidoProgramadoDesde = params.horaProgramadaAt
    const impactoMin = Math.ceil((params.horaProgramadaAt.getTime() - ahora.getTime()) / 60_000)
    bloqueos.push({
      tipo:        'pedido_programado',
      descripcion: `Pedido programado para las ${params.horaProgramadaAt.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}`,
      resolucionEstimadaAt: params.horaProgramadaAt,
      impactoMinutos: impactoMin,
    })
  }

  // ── 4. Calcular cuándo puede salir (máximo de todos los bloqueos) ───────────
  const disponibleDesde = new Date(Math.max(
    vehiculoDisponibleDesde.getTime(),
    repartidorDisponibleDesde.getTime(),
    pedidoProgramadoDesde.getTime(),
    ahora.getTime(),
  ))

  const tiempoBloqueoMin = Math.ceil((disponibleDesde.getTime() - ahora.getTime()) / 60_000)

  // ── 5. Calcular tiempo de ruta con OSRM ─────────────────────────────────────
  let tiempoRutaMin = 15  // default razonable
  let distanciaKm   = 2
  let fuente: 'osrm' | 'haversine' | 'sin_ruta' = 'sin_ruta'

  if (clienteCoords) {
    try {
      const ruta = await calcularRuta(ferreteriaCoords, clienteCoords, velocidadKmh)
      tiempoRutaMin = ruta.duracionMin
      distanciaKm   = ruta.distanciaKm
      fuente        = ruta.polyline ? 'osrm' : 'haversine'
    } catch {
      fuente = 'haversine'
    }
  }

  // ── 6. Penalización por hora pico ────────────────────────────────────────────
  const hora    = horaLima()
  const factor  = HORAS_PICO[hora] ?? 1.0
  tiempoRutaMin = Math.ceil(tiempoRutaMin * factor)

  // ── 7. Penalización por zona (factores históricos) ───────────────────────────
  let penalizacionZonaMin = 0
  if (params.zonaDeliveryId) {
    const diaSemana = disponibleDesde.getDay()
    const { data: factorZona } = await supabase
      .from('delivery_zona_factores')
      .select('factor_demora, penalizacion_min')
      .eq('ferreteria_id', ferreteriaId)
      .eq('zona_delivery_id', params.zonaDeliveryId)
      .eq('dia_semana', diaSemana)
      .eq('hora_bloque', hora)
      .maybeSingle()

    if (factorZona) {
      tiempoRutaMin      = Math.ceil(tiempoRutaMin * (factorZona.factor_demora as number))
      penalizacionZonaMin = factorZona.penalizacion_min as number
    }
  }

  // ── 8. Penalización por peso de pedido ───────────────────────────────────────
  let penalizacionPesoMin = 0
  if (params.pesoTotalKg) {
    if (params.pesoTotalKg > 100)     penalizacionPesoMin = 10
    else if (params.pesoTotalKg > 50) penalizacionPesoMin = 5
    else if (params.pesoTotalKg > 20) penalizacionPesoMin = 2
  }

  // ── 9. Penalización por cola (pedidos antes en cola) ─────────────────────────
  const { count: pedidosEnCola } = await supabase
    .from('delivery_queue')
    .select('id', { count: 'exact', head: true })
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'esperando')
    .lt('score', 9999)  // todos los en espera

  const penalizacionColaMin = Math.min((pedidosEnCola ?? 0) * 3, 30)  // max 30min de cola

  // ── 10. ETA final ────────────────────────────────────────────────────────────
  const etaMinutos = tiempoBloqueoMin + tiempoRutaMin + penalizacionZonaMin + penalizacionPesoMin + penalizacionColaMin

  return {
    etaMinutos: Math.max(etaMinutos, 5),  // mínimo 5 minutos
    distanciaKm,
    disponibleDesde,
    bloqueos,
    hayBloqueos: bloqueos.length > 0,
    fuente,
    detalleCalculo: {
      tiempoBloqueoMin,
      tiempoRutaMin,
      penalizacionZonaMin,
      penalizacionPesoMin,
      penalizacionColaMin,
    },
  }
}

// ── Recalcular ETAs de toda la cola tras un evento ────────────────────────────

/**
 * Cuando un evento rompe el plan (avería, nueva entrega, etc.),
 * recalcular ETAs de todos los pedidos afectados en la cola.
 */
export async function recalcularETAsCascada(
  ferreteriaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<number> {
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('lat, lng')
    .eq('id', ferreteriaId)
    .single()

  if (!ferreteria?.lat || !ferreteria?.lng) return 0

  const ferreteriaCoords: Coords = { lat: ferreteria.lat as number, lng: ferreteria.lng as number }

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, cliente_lat, cliente_lng, zona_delivery_id, peso_total_kg, fecha_programada')
    .eq('ferreteria_id', ferreteriaId)
    .eq('modalidad', 'delivery')
    .in('estado', ['confirmado', 'en_preparacion', 'enviado', 'programado'])

  if (!pedidos?.length) return 0

  let actualizados = 0

  // Procesar en batches de 5 para no saturar OSRM
  for (let i = 0; i < pedidos.length; i += 5) {
    const batch = pedidos.slice(i, i + 5)
    await Promise.all(batch.map(async (p: Record<string, unknown>) => {
      try {
        const clienteCoords = p.cliente_lat && p.cliente_lng
          ? { lat: p.cliente_lat as number, lng: p.cliente_lng as number }
          : null

        const resultado = await calcularCascadaETA({
          ferreteriaId,
          ferreteriaCoords,
          clienteCoords,
          pedidoId:        p.id as string,
          zonaDeliveryId:  p.zona_delivery_id as string | null,
          pesoTotalKg:     (p.peso_total_kg as number | null) ?? undefined,
          horaProgramadaAt: p.fecha_programada ? new Date(p.fecha_programada as string) : null,
          supabase,
        })

        await Promise.all([
          supabase.from('pedidos')
            .update({ eta_minutos: resultado.etaMinutos })
            .eq('id', p.id).eq('ferreteria_id', ferreteriaId),
          supabase.from('entregas')
            .update({
              eta_actual:            new Date(Date.now() + resultado.etaMinutos * 60_000).toISOString(),
              duracion_estimada_min: resultado.etaMinutos,
              eta_calculado_at:      new Date().toISOString(),
              bloqueado_hasta_at:    resultado.hayBloqueos ? resultado.disponibleDesde.toISOString() : null,
              motivo_bloqueo:        resultado.bloqueos[0]?.descripcion ?? null,
            })
            .eq('pedido_id', p.id).eq('ferreteria_id', ferreteriaId),
        ])

        actualizados++
      } catch {
        // No detener el batch por un error individual
      }
    }))
  }

  return actualizados
}
