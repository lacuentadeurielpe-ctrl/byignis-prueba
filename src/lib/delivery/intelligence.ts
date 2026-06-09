/**
 * Delivery Intelligence — Motor de ETA Inteligente (v2)
 *
 * Cadena de cálculo (fallback layers):
 *   1. Google Routes API (traffic-aware) → si NEXT_PUBLIC_GOOGLE_MAPS_API_KEY existe
 *   2. Regresión lineal ponderada por recencia (simple-statistics)
 *      → si hay >=10 predicciones con resultado real en la zona
 *   3. Zone stats históricos (avg/p90) → si hay >=5 entregas en zona+hora+día
 *   4. Haversine + factor urbano + hora pico + factores de zona
 *
 * Mejoras v2:
 *   - Usa specs reales del vehículo asignado (velocidad, capacidad)
 *   - Regresión lineal con recencia (últimos 30 días valen más)
 *   - P90 para ETAs al cliente (no el promedio — el percentil 90)
 *   - Detección de anomalías (excluye outliers del modelo)
 *   - Factor de zona desde delivery_zona_factores
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import * as ss from 'simple-statistics'
import { getDistanceWithTraffic } from './google-routes'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParamsETAInteligente {
  ferreteriaId: string
  ferreteriaLat: number
  ferreteriaLng: number
  clienteLat: number
  clienteLng: number
  zonaDeliveryId?: string | null
  vehiculoId?: string | null       // ID del vehículo asignado → pulls specs from DB
  vehiculoTipo?: string | null     // fallback si no hay vehiculoId
  velocidadKmh?: number            // override manual (ignora DB si se pasa)
  pesoTotalKg?: number
  itemsCount?: number
  pedidosEnCola?: number
  usarP90?: boolean                // true = usar percentil 90 en vez de promedio (para notificar al cliente)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
}

export interface ETAInteligenteResult {
  etaMinutos: number
  distanciaKm: number
  confidence: number            // 0.0 – 1.0
  source: 'google' | 'zone_avg' | 'haversine'
  adjustments: {
    trafficFactor: number
    queuePenaltyMin: number
    weightPenaltyMin: number
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const R_TIERRA_KM = 6371
const FACTOR_URBANO = 1.35
const T_PREP_BASE = 10      // min prep base
const T_PREP_COLA = 3       // min extra por pedido en cola
const CONFIDENCE_MIN_ENTREGAS = 5

// Horas pico Lima: multiplicador de tráfico
const HORAS_PICO: Record<number, number> = {
  7: 1.3, 8: 1.4, 9: 1.3,           // mañana
  12: 1.2, 13: 1.25, 14: 1.15,      // almuerzo
  17: 1.35, 18: 1.45, 19: 1.4, 20: 1.25,  // tarde-noche
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Hora actual en Lima (0-23) */
function horaLima(): number {
  return new Date().toLocaleString('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false }) as unknown as number
}

/** Día de la semana Lima (0=Domingo, 6=Sábado) */
function diaLima(): number {
  const limaStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Lima', weekday: 'short' })
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[limaStr] ?? new Date().getDay()
}

function getTrafficFactor(hora: number): number {
  return HORAS_PICO[hora] ?? 1.0
}

function getWeightPenalty(pesoKg: number): number {
  // > 50 kg → +5 min (carga pesada), > 100 kg → +10 min
  if (pesoKg > 100) return 10
  if (pesoKg > 50) return 5
  if (pesoKg > 20) return 2
  return 0
}

// ── Obtener specs reales del vehículo ─────────────────────────────────────────

async function obtenerSpecsVehiculo(
  vehiculoId: string | null | undefined,
  vehiculoTipoFallback: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<{ velocidadKmh: number; capacidadKg: number; tipo: string }> {
  if (vehiculoId) {
    const { data: v } = await supabase
      .from('vehiculos_delivery')
      .select('tipo, velocidad_kmh, capacidad_kg')
      .eq('id', vehiculoId)
      .maybeSingle()

    if (v) {
      return {
        velocidadKmh: (v.velocidad_kmh as number) ?? 30,
        capacidadKg:  (v.capacidad_kg  as number) ?? 150,
        tipo:         (v.tipo          as string) ?? 'moto',
      }
    }
  }

  // Fallback por tipo de vehículo
  const tipo = vehiculoTipoFallback ?? 'moto'
  const defaults: Record<string, { vel: number; cap: number }> = {
    moto:       { vel: 35, cap: 80  },
    auto:       { vel: 28, cap: 400 },
    bicicleta:  { vel: 15, cap: 30  },
    camion:     { vel: 22, cap: 1500 },
  }
  const d = defaults[tipo] ?? defaults.moto
  return { velocidadKmh: d.vel, capacidadKg: d.cap, tipo }
}

// ── Regresión lineal ponderada por recencia (simple-statistics) ──────────────

async function calcularETARegresion(
  ferreteriaId:  string,
  zonaDeliveryId: string,
  distanciaKm:   number,
  hora:          number,
  dia:           number,
  vehiculoTipo:  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:      SupabaseClient<any>,
  usarP90 = false,
): Promise<{ etaMin: number; confidence: number } | null> {
  const cutoff30d = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const cutoff90d = new Date(Date.now() - 90 * 24 * 3600 * 1000)

  // Traer predicciones completadas de esta zona (últimos 90 días)
  const { data: preds } = await supabase
    .from('delivery_predictions')
    .select('duracion_real_min, distancia_km, hora_dia, dia_semana, vehiculo_tipo, created_at, error_min')
    .eq('ferreteria_id', ferreteriaId)
    .eq('zona_delivery_id', zonaDeliveryId)
    .not('duracion_real_min', 'is', null)
    .gte('created_at', cutoff90d.toISOString())
    .or('owner_feedback->inusual.is.null,owner_feedback->inusual.eq.false')

  if (!preds || preds.length < 10) return null

  // Detección de anomalías: excluir valores que se desvían >2 desviaciones estándar
  const duraciones = preds.map((p: Record<string, unknown>) => p.duracion_real_min as number)
  const meanDur  = ss.mean(duraciones)
  const stdDur   = ss.standardDeviation(duraciones)
  const umbralMin = meanDur - 2 * stdDur
  const umbralMax = meanDur + 2 * stdDur

  const predsFiltradas = preds.filter((p: Record<string, unknown>) => {
    const d = p.duracion_real_min as number
    return d >= umbralMin && d <= umbralMax
  })

  if (predsFiltradas.length < 8) return null

  // Peso por recencia: predicciones del último mes valen 3x más
  const puntos: Array<[number, number]> = predsFiltradas.map((p: Record<string, unknown>) => {
    const esReciente = new Date(p.created_at as string) >= cutoff30d
    const peso = esReciente ? 3 : 1

    // Variables de entrada para la regresión:
    // x = distancia_km (principal predictor)
    // Ajuste adicional: mismo tipo de vehículo y franja horaria similar
    const mismoVehiculo = p.vehiculo_tipo === vehiculoTipo ? 1.0 : 0.8
    const mismaHora     = Math.abs((p.hora_dia as number) - hora) <= 2 ? 1.0 : 0.7
    const mismaZonaTemporal = mismaHora * mismoVehiculo

    // Para regresión ponderada: duplicar los puntos pesados
    return Array.from({ length: peso }, () =>
      [(p.distancia_km as number) * mismaZonaTemporal, (p.duracion_real_min as number)] as [number, number]
    )
  }).flat()

  try {
    const regresion = ss.linearRegression(puntos)
    const prediccion = ss.linearRegressionLine(regresion)
    const etaBase = prediccion(distanciaKm)

    if (etaBase <= 0) return null

    // Si usarP90: calcular percentil 90 de los residuales y sumarlo
    let etaFinal = etaBase
    if (usarP90) {
      const residuales = predsFiltradas.map((p: Record<string, unknown>) =>
        (p.duracion_real_min as number) - prediccion(p.distancia_km as number)
      )
      const p90Residual = ss.quantile(residuales.sort((a, b) => a - b), 0.9)
      etaFinal = etaBase + Math.max(p90Residual, 0)
    }

    // Confidence basada en R² de la regresión
    const yActuales = puntos.map(p => p[1])
    const yPredichos = puntos.map(p => prediccion(p[0]))
    const rSquared = ss.rSquared(puntos, prediccion)
    const confidence = Math.min(0.88, Math.max(0.5, rSquared * 0.9))

    return { etaMin: Math.ceil(etaFinal), confidence }
  } catch {
    return null
  }
}

// ── Main ETA Calculator v2 ────────────────────────────────────────────────────

export async function calcularETAInteligente(
  params: ParamsETAInteligente,
): Promise<ETAInteligenteResult> {
  const {
    ferreteriaId,
    ferreteriaLat, ferreteriaLng,
    clienteLat, clienteLng,
    zonaDeliveryId,
    vehiculoId,
    velocidadKmh: velocidadOverride,
    pesoTotalKg = 0,
    pedidosEnCola = 0,
    usarP90 = false,
    supabase,
  } = params

  const hora = horaLima()
  const dia  = diaLima()

  // ── Obtener specs del vehículo real ───────────────────────────────────────
  const specs = await obtenerSpecsVehiculo(vehiculoId, params.vehiculoTipo, supabase)
  const velocidadKmh = velocidadOverride ?? specs.velocidadKmh

  const trafficFactor  = getTrafficFactor(hora)
  const queuePenalty   = T_PREP_BASE + pedidosEnCola * T_PREP_COLA
  const weightPenalty  = getWeightPenalty(pesoTotalKg)

  const adjustments = {
    trafficFactor,
    queuePenaltyMin:  queuePenalty,
    weightPenaltyMin: weightPenalty,
  }

  // Factor de zona (incidencias históricas)
  let factorZona = 1.0
  let penalizacionZonaMin = 0
  if (zonaDeliveryId) {
    const { data: fz } = await supabase
      .from('delivery_zona_factores')
      .select('factor_demora, penalizacion_min')
      .eq('ferreteria_id', ferreteriaId)
      .eq('zona_delivery_id', zonaDeliveryId)
      .eq('dia_semana', dia)
      .eq('hora_bloque', hora)
      .maybeSingle()

    if (fz) {
      factorZona          = (fz.factor_demora    as number) ?? 1.0
      penalizacionZonaMin = (fz.penalizacion_min as number) ?? 0
    }
  }

  // ── Layer 1: Google Routes API ────────────────────────────────────────────
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (googleApiKey) {
    try {
      const gResult = await getDistanceWithTraffic(
        { lat: ferreteriaLat, lng: ferreteriaLng },
        { lat: clienteLat,    lng: clienteLng    },
        googleApiKey,
      )

      if (gResult) {
        const etaRuta  = gResult.duracionTraficoMin * factorZona
        const etaTotal = etaRuta + queuePenalty + weightPenalty + penalizacionZonaMin

        return {
          etaMinutos:  Math.ceil(etaTotal),
          distanciaKm: gResult.distanciaKm,
          confidence:  0.9,
          source:      'google',
          adjustments,
        }
      }
    } catch (e) {
      console.warn('[Intelligence] Google Routes fallback:', e)
    }
  }

  // ── Distancia Haversine (necesaria para layers 2-4) ───────────────────────
  const distLineal = haversineKm(ferreteriaLat, ferreteriaLng, clienteLat, clienteLng)
  const distKm     = Math.round(distLineal * FACTOR_URBANO * 10) / 10

  // ── Layer 2: Regresión lineal ponderada por recencia (simple-statistics) ──
  if (zonaDeliveryId) {
    try {
      const regResult = await calcularETARegresion(
        ferreteriaId, zonaDeliveryId, distKm, hora, dia, specs.tipo, supabase, usarP90,
      )

      if (regResult) {
        const etaTotal = regResult.etaMin * factorZona + queuePenalty + weightPenalty + penalizacionZonaMin
        return {
          etaMinutos:  Math.ceil(etaTotal),
          distanciaKm: distKm,
          confidence:  regResult.confidence,
          source:      'zone_avg',
          adjustments,
        }
      }
    } catch (e) {
      console.warn('[Intelligence] Regresión fallback:', e)
    }
  }

  // ── Layer 3: Zone stats históricos (avg o p90) ────────────────────────────
  if (zonaDeliveryId) {
    try {
      const { data: stats } = await supabase
        .from('delivery_zone_stats')
        .select('avg_duracion_min, entregas_count, p90_duracion_min')
        .eq('ferreteria_id', ferreteriaId)
        .eq('zona_delivery_id', zonaDeliveryId)
        .eq('hora_bloque', hora)
        .eq('dia_semana', dia)
        .maybeSingle()

      if (stats && (stats.entregas_count ?? 0) >= CONFIDENCE_MIN_ENTREGAS) {
        const durBase    = usarP90
          ? ((stats.p90_duracion_min as number) ?? (stats.avg_duracion_min as number))
          : (stats.avg_duracion_min as number)
        const etaTotal   = durBase * factorZona + queuePenalty + weightPenalty + penalizacionZonaMin
        const confidence = Math.min(0.85, 0.5 + (stats.entregas_count as number) / 100)

        return {
          etaMinutos:  Math.ceil(etaTotal),
          distanciaKm: distKm,
          confidence,
          source:      'zone_avg',
          adjustments,
        }
      }
    } catch (e) {
      console.warn('[Intelligence] Zone stats fallback:', e)
    }
  }

  // ── Layer 4: Haversine + ajustes ──────────────────────────────────────────
  const tRuta    = Math.ceil((distKm / velocidadKmh) * 60 * trafficFactor * factorZona)
  const etaTotal = tRuta + queuePenalty + weightPenalty + penalizacionZonaMin

  return {
    etaMinutos:  Math.ceil(etaTotal),
    distanciaKm: distKm,
    confidence:  0.0,
    source:      'haversine',
    adjustments,
  }
}

// ── Prediction Registration ──────────────────────────────────────────────────

interface RegistrarPrediccionParams {
  ferreteriaId: string
  entregaId: string
  pedidoId: string
  zonaDeliveryId?: string | null
  vehiculoTipo?: string | null
  result: ETAInteligenteResult
  itemsCount?: number
  pesoTotalKg?: number
  pedidosEnCola?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
}

export async function registrarPrediccion(params: RegistrarPrediccionParams): Promise<string | null> {
  const {
    ferreteriaId, entregaId, pedidoId,
    zonaDeliveryId, vehiculoTipo,
    result, itemsCount, pesoTotalKg, pedidosEnCola,
    supabase,
  } = params

  try {
    const hora = horaLima()
    const dia = diaLima()

    const { data, error } = await supabase
      .from('delivery_predictions')
      .insert({
        ferreteria_id: ferreteriaId,
        entrega_id: entregaId,
        pedido_id: pedidoId,
        zona_delivery_id: zonaDeliveryId ?? null,
        vehiculo_tipo: vehiculoTipo ?? null,
        distancia_km: result.distanciaKm,
        peso_total_kg: pesoTotalKg ?? null,
        items_count: itemsCount ?? null,
        cola_depth: pedidosEnCola ?? null,
        hora_dia: hora,
        dia_semana: dia,
        eta_predicho_min: result.etaMinutos,
        eta_source: result.source,
        confidence: result.confidence,
        model_version: 'v1',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Intelligence] Error registrando predicción:', error.message)
      return null
    }

    return data?.id ?? null
  } catch (e) {
    console.error('[Intelligence] registrarPrediccion exception:', e)
    return null
  }
}

// ── Prediction Completion (backfill) ─────────────────────────────────────────

export async function completarPrediccion(
  entregaId: string,
  duracionRealMin: number,
  ferreteriaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  try {
    // 1. Find the prediction for this entrega
    const { data: pred } = await supabase
      .from('delivery_predictions')
      .select('id, eta_predicho_min, zona_delivery_id')
      .eq('entrega_id', entregaId)
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()

    if (!pred) return

    // 2. Backfill real duration + error
    const errorMin = (pred.eta_predicho_min as number) - duracionRealMin

    await supabase
      .from('delivery_predictions')
      .update({
        duracion_real_min: duracionRealMin,
        error_min: errorMin,
      })
      .eq('id', pred.id)

    // 3. Recalculate zone stats if there's a zone
    if (pred.zona_delivery_id) {
      await recalcularZoneStats(ferreteriaId, pred.zona_delivery_id as string, supabase)
    }
  } catch (e) {
    console.error('[Intelligence] completarPrediccion error:', e)
  }
}

// ── Zone Stats Recalculation ─────────────────────────────────────────────────

export async function recalcularZoneStats(
  ferreteriaId: string,
  zonaDeliveryId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  windowDays = 90,
): Promise<void> {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - windowDays)

    // Fetch all completed predictions for this zone within the window
    const { data: predictions } = await supabase
      .from('delivery_predictions')
      .select('duracion_real_min, error_min, hora_dia, dia_semana')
      .eq('ferreteria_id', ferreteriaId)
      .eq('zona_delivery_id', zonaDeliveryId)
      .not('duracion_real_min', 'is', null)
      .gte('created_at', cutoff.toISOString())
      // Exclude owner-marked anomalies
      .or('owner_feedback->inusual.is.null,owner_feedback->inusual.eq.false')

    if (!predictions?.length) return

    // Group by (hora_dia, dia_semana)
    const groups = new Map<string, number[]>()
    const errors = new Map<string, number[]>()

    for (const p of predictions) {
      const key = `${p.hora_dia}-${p.dia_semana}`
      if (!groups.has(key)) {
        groups.set(key, [])
        errors.set(key, [])
      }
      groups.get(key)!.push(p.duracion_real_min as number)
      if (p.error_min != null) errors.get(key)!.push(p.error_min as number)
    }

    // Upsert each group
    for (const [key, durations] of groups) {
      const [horaStr, diaStr] = key.split('-')
      const hora = parseInt(horaStr, 10)
      const dia = parseInt(diaStr, 10)

      durations.sort((a, b) => a - b)
      const count = durations.length
      const avg = durations.reduce((s, v) => s + v, 0) / count
      const median = count % 2 === 0
        ? (durations[count / 2 - 1] + durations[count / 2]) / 2
        : durations[Math.floor(count / 2)]
      const p90idx = Math.ceil(count * 0.9) - 1
      const p90 = durations[Math.max(0, p90idx)]

      const errArr = errors.get(key) ?? []
      const avgError = errArr.length > 0
        ? errArr.reduce((s, v) => s + v, 0) / errArr.length
        : null

      await supabase
        .from('delivery_zone_stats')
        .upsert(
          {
            ferreteria_id: ferreteriaId,
            zona_delivery_id: zonaDeliveryId,
            hora_bloque: hora,
            dia_semana: dia,
            entregas_count: count,
            avg_duracion_min: Math.round(avg * 100) / 100,
            median_duracion_min: Math.round(median * 100) / 100,
            p90_duracion_min: Math.round(p90 * 100) / 100,
            avg_error_min: avgError != null ? Math.round(avgError * 100) / 100 : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'ferreteria_id,zona_delivery_id,hora_bloque,dia_semana' },
        )
    }
  } catch (e) {
    console.error('[Intelligence] recalcularZoneStats error:', e)
  }
}
