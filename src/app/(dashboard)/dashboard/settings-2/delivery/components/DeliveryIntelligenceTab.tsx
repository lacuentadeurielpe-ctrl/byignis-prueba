'use client'

import { useState, useEffect } from 'react'
import { Brain, RefreshCw } from 'lucide-react'
import IntelligenceOverview from './IntelligenceOverview'
import ZonePerformanceChart from './ZonePerformanceChart'
import TrafficHeatmap from './TrafficHeatmap'
import PredictionReviewTable from './PredictionReviewTable'

interface StatsData {
  overview: {
    totalPredicciones: number
    completadas: number
    accuracyPct: number
    avgErrorMin: number
    avgConfidencePct: number
    sourceBreakdown: {
      google: number
      zone_avg: number
      haversine: number
    }
  }
  zonePerformance: Array<{
    zonaId: string
    nombre: string
    entregas: number
    avgDuracionMin: number
  }>
  heatmap: Array<{
    dia: number
    hora: number
    avgMin: number
    count: number
  }>
}

export default function DeliveryIntelligenceTab() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/delivery/intelligence/stats')
      if (!res.ok) throw new Error('Error cargando estadísticas')
      const data = await res.json()
      setStats(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <Brain className="w-8 h-8 text-indigo-400 mx-auto animate-pulse" />
          <p className="text-sm text-zinc-500">Cargando inteligencia...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-rose-600">{error}</p>
        <button onClick={fetchStats} className="text-sm text-indigo-600 hover:underline">
          Reintentar
        </button>
      </div>
    )
  }

  if (!stats) return null

  const isEmpty = stats.overview.totalPredicciones === 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Brain className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900">Inteligencia de Entregas</h3>
            <p className="text-sm text-zinc-500">
              El sistema aprende de cada entrega para mejorar las predicciones de ETA
            </p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {isEmpty ? (
        <div className="text-center py-16 bg-zinc-50 rounded-xl border border-zinc-200">
          <Brain className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h4 className="font-medium text-zinc-700 mb-2">Sin datos de entrenamiento</h4>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Cuando empieces a hacer entregas, el sistema registrará predicciones y resultados
            reales para auto-mejorarse. Cada entrega completada es un dato de entrenamiento.
          </p>
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <IntelligenceOverview overview={stats.overview} />

          {/* Zone performance */}
          {stats.zonePerformance.length > 0 && (
            <ZonePerformanceChart zones={stats.zonePerformance} />
          )}

          {/* Traffic heatmap */}
          {stats.heatmap.length > 0 && (
            <TrafficHeatmap data={stats.heatmap} />
          )}

          {/* Prediction review table */}
          <PredictionReviewTable />
        </>
      )}
    </div>
  )
}
