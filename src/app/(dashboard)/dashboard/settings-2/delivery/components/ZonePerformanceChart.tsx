'use client'

import { MapPin } from 'lucide-react'

interface ZonePerformanceProps {
  zones: Array<{
    zonaId: string
    nombre: string
    entregas: number
    avgDuracionMin: number
  }>
}

export default function ZonePerformanceChart({ zones }: ZonePerformanceProps) {
  const maxDuracion = Math.max(...zones.map(z => z.avgDuracionMin), 1)

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-medium text-zinc-700">Rendimiento por Zona</h4>
      </div>

      <div className="space-y-3">
        {zones.slice(0, 10).map(zone => {
          const pct = (zone.avgDuracionMin / maxDuracion) * 100
          const color = zone.avgDuracionMin <= 30
            ? 'bg-emerald-500'
            : zone.avgDuracionMin <= 45
            ? 'bg-amber-500'
            : 'bg-rose-500'

          return (
            <div key={zone.zonaId}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-700 font-medium truncate max-w-[200px]">{zone.nombre}</span>
                <span className="text-zinc-500 whitespace-nowrap ml-2">
                  ~{Math.round(zone.avgDuracionMin)} min · {zone.entregas} entregas
                </span>
              </div>
              <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {zones.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-4">
          Sin datos de zonas aún
        </p>
      )}
    </div>
  )
}
