/**
 * Delivery Intelligence — Motor de ETA Inteligente
 *
 * Cadena de cálculo (fallback layers):
 *   1. Google Routes API (traffic-aware) → si NEXT_PUBLIC_GOOGLE_MAPS_API_KEY existe
 *   2. Zone stats históricos → si hay >=5 entregas en zona+hora+día
 *   3. Ajustes por hora pico Lima, peso, cola
 *   4. Haversine + factor urbano 1.35x → siempre disponible
 *
 * Funciones auxiliares:
 *   - registrarPrediccion() → inserta en delivery_predictions
 *   - completarPrediccion() → backfill resultado + recalcular stats
 *   - recalcularZoneStats() → re-agregar últimos N días
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDistanceWithTraffic } from './google-routes'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParamsETAInteligente {
  ferreteriaId: string
  ferreteriaLat: number
  ferreteriaLng: number
  clienteLat: number
  clienteLng: number
  zonaDeliveryId?: string | null
  vehiculoTipo?: string | null
  velocidadKmh?: number
  pesoTotalKg?: number
  itemsCount?: number
  pedidosEnCola?: number
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

// ── Main ETA Calculator ──────────────────────────────────────────────────────

export async function calcularETAInteligente(
  params: ParamsETAInteligente,
): Promise<ETAInteligenteResult> {
  const {
    ferreteriaId,
    ferreteriaLat, ferreteriaLng,
    clienteLat, clienteLng,
    zonaDeliveryId,
    velocidadKmh = 30,
    pesoTotalKg = 0,
    pedidosEnCola = 0,
    supabase,
  } = params

  const hora = horaLima()
  const dia = diaLima()
  const trafficFactor = getTrafficFactor(hora)
  const queuePenalty = T_PREP_BASE + pedidosEnCola * T_PREP_COLA
  const weightPenalty = getWeightPenalty(pesoTotalKg)

  const adjustments = {
    trafficFactor,
    queuePenaltyMin: queuePenalty,
    weightPenaltyMin: weightPenalty,
  }

  // ── Layer 1: Google Routes API ────────────────────────────────────────────
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (googleApiKey) {
    try {
      const gResult = await getDistanceWithTraffic(
        { lat: ferreteriaLat, lng: ferreteriaLng },
        { lat: clienteLat, lng: clienteLng },
        googleApiKey,
      )

      if (gResult) {
        const etaRuta = gResult.duracionTraficoMin
        const etaTotal = etaRuta + queuePenalty + weightPenalty

        return {
          etaMinutos: Math.ceil(etaTotal),
          distanciaKm: gResult.distanciaKm,
          confidence: 0.9,
          source: 'google',
          adjustments,
        }
      }
    } catch (e) {
      console.warn('[Intelligence] Google Routes fallback:', e)
    }
  }

  // ── Layer 2: Zone historical stats ────────────────────────────────────────
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
        const avgDuracion = stats.avg_duracion_min as number
        // Adjust by current queue + weight
        const etaTotal = avgDuracion + queuePenalty + weightPenalty

        // Confidence based on sample size (caps at 0.85 for zone avg)
        const sampleConfidence = Math.min(0.85, 0.5 + (stats.entregas_count as number) / 100)

        // Calculate distance via Haversine for the record
        const distLineal = haversineKm(ferreteriaLat, ferreteriaLng, clienteLat, clienteLng)
        const distKm = Math.round(distLineal * FACTOR_URBANO * 10) / 10

        return {
          etaMinutos: Math.ceil(etaTotal),
          distanciaKm: distKm,
          confidence: sampleConfidence,
          source: 'zone_avg',
          adjustments,
        }
      }
    } catch (e) {
      console.warn('[Intelligence] Zone stats fallback:', e)
    }
  }

  // ── Layer 3 & 4: Haversine + adjustments ──────────────────────────────────
  const distLineal = haversineKm(ferreteriaLat, ferreteriaLng, clienteLat, clienteLng)
  const distKm = Math.round(distLineal * FACTOR_URBANO * 10) / 10
  const tRuta = Math.ceil((distKm / velocidadKmh) * 60 * trafficFactor)
  const etaTotal = tRuta + queuePenalty + weightPenalty

  return {
    etaMinutos: Math.ceil(etaTotal),
    distanciaKm: distKm,
    confidence: 0.0,    // cold start — no historical data
    source: 'haversine',
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
