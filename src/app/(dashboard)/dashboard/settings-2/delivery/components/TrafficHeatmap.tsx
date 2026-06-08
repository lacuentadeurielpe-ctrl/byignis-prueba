'use client'

import { Clock } from 'lucide-react'

interface TrafficHeatmapProps {
  data: Array<{
    dia: number
    hora: number
    avgMin: number
    count: number
  }>
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const HORAS = Array.from({ length: 24 }, (_, i) => i)

function getColor(avgMin: number | null): string {
  if (avgMin == null) return 'bg-zinc-50'
  if (avgMin <= 20) return 'bg-emerald-200'
  if (avgMin <= 30) return 'bg-emerald-400'
  if (avgMin <= 40) return 'bg-amber-300'
  if (avgMin <= 50) return 'bg-amber-500'
  if (avgMin <= 60) return 'bg-orange-500'
  return 'bg-rose-500'
}

export default function TrafficHeatmap({ data }: TrafficHeatmapProps) {
  // Build lookup map
  const lookup = new Map<string, { avgMin: number; count: number }>()
  for (const d of data) {
    lookup.set(`${d.dia}-${d.hora}`, { avgMin: d.avgMin as number, count: d.count as number })
  }

  // Only show hours 6-22 (business hours)
  const horasVisibles = HORAS.filter(h => h >= 6 && h <= 22)

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-medium text-zinc-700">Mapa de Tráfico</h4>
        <span className="text-xs text-zinc-400 ml-auto">
          Tiempo promedio de entrega por hora y día
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour headers */}
          <div className="flex gap-0.5 mb-1 ml-10">
            {horasVisibles.map(h => (
              <div key={h} className="flex-1 text-center text-[10px] text-zinc-400">
                {h}h
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DIAS.map((dia, diaIdx) => (
            <div key={dia} className="flex gap-0.5 mb-0.5 items-center">
              <div className="w-10 text-xs text-zinc-500 text-right pr-2 shrink-0">{dia}</div>
              {horasVisibles.map(hora => {
                const cell = lookup.get(`${diaIdx}-${hora}`)
                const bg = getColor(cell?.avgMin ?? null)
                const title = cell
                  ? `${dia} ${hora}:00 — ~${Math.round(cell.avgMin)} min (${cell.count} entregas)`
                  : `${dia} ${hora}:00 — sin datos`
                return (
                  <div
                    key={hora}
                    className={`flex-1 h-6 rounded-sm ${bg} cursor-default transition-colors hover:opacity-80`}
                    title={title}
                  />
                )
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 ml-10">
            <span className="text-[10px] text-zinc-400">Rápido</span>
            <div className="flex gap-0.5">
              {['bg-emerald-200', 'bg-emerald-400', 'bg-amber-300', 'bg-amber-500', 'bg-orange-500', 'bg-rose-500'].map(c => (
                <div key={c} className={`w-4 h-3 rounded-sm ${c}`} />
              ))}
            </div>
            <span className="text-[10px] text-zinc-400">Lento</span>
            <div className="ml-2 flex items-center gap-1">
              <div className="w-4 h-3 rounded-sm bg-zinc-50 border border-zinc-200" />
              <span className="text-[10px] text-zinc-400">Sin datos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
