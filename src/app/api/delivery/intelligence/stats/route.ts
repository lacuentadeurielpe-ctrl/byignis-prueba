/**
 * GET /api/delivery/intelligence/stats
 * Zone performance stats for the intelligence dashboard
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  // Overview metrics (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: predictions } = await supabase
    .from('delivery_predictions')
    .select('eta_predicho_min, duracion_real_min, error_min, eta_source, confidence')
    .eq('ferreteria_id', session.ferreteriaId)
    .gte('created_at', thirtyDaysAgo.toISOString())

  const total = predictions?.length ?? 0
  const completed = predictions?.filter(p => p.duracion_real_min != null) ?? []
  const completedCount = completed.length

  // Accuracy metrics
  let avgErrorMin = 0
  let accuracyPct = 0
  let avgConfidence = 0

  if (completedCount > 0) {
    const errors = completed.map(p => Math.abs(p.error_min as number))
    avgErrorMin = Math.round((errors.reduce((s, v) => s + v, 0) / completedCount) * 10) / 10

    // "Accurate" = within 10 minutes
    const accurate = errors.filter(e => e <= 10).length
    accuracyPct = Math.round((accurate / completedCount) * 100)

    avgConfidence = Math.round(
      (completed.reduce((s, p) => s + (p.confidence as number ?? 0), 0) / completedCount) * 100,
    )
  }

  // Source breakdown
  const sourceBreakdown = {
    google: predictions?.filter(p => p.eta_source === 'google').length ?? 0,
    zone_avg: predictions?.filter(p => p.eta_source === 'zone_avg').length ?? 0,
    haversine: predictions?.filter(p => p.eta_source === 'haversine').length ?? 0,
  }

  // Zone stats
  const { data: zoneStats } = await supabase
    .from('delivery_zone_stats')
    .select('zona_delivery_id, hora_bloque, dia_semana, avg_duracion_min, entregas_count, p90_duracion_min')
    .eq('ferreteria_id', session.ferreteriaId)

  // Zone names
  const zoneIds = [...new Set(zoneStats?.map(z => z.zona_delivery_id) ?? [])]
  const { data: zonas } = await supabase
    .from('zonas_delivery')
    .select('id, nombre')
    .in('id', zoneIds.length > 0 ? zoneIds : ['__none__'])

  const zonasMap = new Map((zonas ?? []).map(z => [z.id, z.nombre]))

  // Aggregate zone performance
  const zonePerformance = zoneIds.map(zoneId => {
    const stats = zoneStats?.filter(z => z.zona_delivery_id === zoneId) ?? []
    const totalEntregas = stats.reduce((s, z) => s + (z.entregas_count as number ?? 0), 0)
    const avgDur = totalEntregas > 0
      ? stats.reduce((s, z) => s + (z.avg_duracion_min as number ?? 0) * (z.entregas_count as number ?? 0), 0) / totalEntregas
      : 0

    return {
      zonaId: zoneId,
      nombre: zonasMap.get(zoneId as string) ?? 'Sin nombre',
      entregas: totalEntregas,
      avgDuracionMin: Math.round(avgDur * 10) / 10,
    }
  }).sort((a, b) => b.entregas - a.entregas)

  // Heatmap data (7 days × 24 hours)
  const heatmap = (zoneStats ?? []).map(s => ({
    dia: s.dia_semana,
    hora: s.hora_bloque,
    avgMin: s.avg_duracion_min,
    count: s.entregas_count,
  }))

  return NextResponse.json({
    overview: {
      totalPredicciones: total,
      completadas: completedCount,
      accuracyPct,
      avgErrorMin,
      avgConfidencePct: avgConfidence,
      sourceBreakdown,
    },
    zonePerformance,
    heatmap,
  })
}
