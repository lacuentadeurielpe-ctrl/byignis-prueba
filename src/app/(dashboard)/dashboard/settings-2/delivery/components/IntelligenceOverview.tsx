'use client'

import { Target, Timer, TrendingUp, Zap } from 'lucide-react'

interface OverviewProps {
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
}

export default function IntelligenceOverview({ overview }: OverviewProps) {
  const cards = [
    {
      label: 'Precisión',
      value: `${overview.accuracyPct}%`,
      sub: `${overview.completadas} entregas evaluadas`,
      icon: Target,
      color: overview.accuracyPct >= 80 ? 'text-emerald-600 bg-emerald-100' :
             overview.accuracyPct >= 60 ? 'text-amber-600 bg-amber-100' :
             'text-rose-600 bg-rose-100',
    },
    {
      label: 'Error Promedio',
      value: `${overview.avgErrorMin} min`,
      sub: overview.avgErrorMin <= 5 ? 'Excelente' : overview.avgErrorMin <= 10 ? 'Bueno' : 'Mejorable',
      icon: Timer,
      color: overview.avgErrorMin <= 5 ? 'text-emerald-600 bg-emerald-100' :
             overview.avgErrorMin <= 10 ? 'text-amber-600 bg-amber-100' :
             'text-rose-600 bg-rose-100',
    },
    {
      label: 'Confianza IA',
      value: `${overview.avgConfidencePct}%`,
      sub: `${overview.totalPredicciones} predicciones totales`,
      icon: TrendingUp,
      color: 'text-indigo-600 bg-indigo-100',
    },
  ]

  const total = overview.sourceBreakdown.google + overview.sourceBreakdown.zone_avg + overview.sourceBreakdown.haversine

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-600">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{card.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Source breakdown bar */}
      {total > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-600">Fuente de predicciones</span>
          </div>

          <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden flex">
            {overview.sourceBreakdown.google > 0 && (
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(overview.sourceBreakdown.google / total) * 100}%` }}
              />
            )}
            {overview.sourceBreakdown.zone_avg > 0 && (
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${(overview.sourceBreakdown.zone_avg / total) * 100}%` }}
              />
            )}
            {overview.sourceBreakdown.haversine > 0 && (
              <div
                className="h-full bg-zinc-400"
                style={{ width: `${(overview.sourceBreakdown.haversine / total) * 100}%` }}
              />
            )}
          </div>

          <div className="flex gap-4 mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Google Routes ({overview.sourceBreakdown.google})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Historial zona ({overview.sourceBreakdown.zone_avg})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              Haversine ({overview.sourceBreakdown.haversine})
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
