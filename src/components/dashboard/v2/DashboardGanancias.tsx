'use client'

import { formatPEN } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/NumberTicker'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, Percent } from 'lucide-react'

interface DashboardGananciasProps {
  gananciaNeta: number
  ingresosTotales: number
  periodoLabel: string
}

export default function DashboardGanancias({
  gananciaNeta,
  ingresosTotales,
  periodoLabel,
}: DashboardGananciasProps) {
  const margen = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-zinc-950 dark:bg-zinc-900 text-white border border-zinc-800 rounded-xl overflow-hidden p-5 sm:p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
              Ganancia Neta · {periodoLabel}
            </p>
          </div>
          <p className="text-[2rem] sm:text-[2.5rem] leading-none font-bold tracking-tight text-white tabular-nums">
            <NumberTicker value={gananciaNeta} format={formatPEN} />
          </p>
          <p className="text-sm text-zinc-500 mt-2">
            Ingreso neto libre de IGV y costos de compra
          </p>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Margen</p>
            <div className="flex items-center gap-1.5 justify-end">
              <Percent className="w-4 h-4 text-emerald-400" />
              <p className="text-xl font-semibold tabular-nums">{margen.toFixed(1)}%</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-zinc-800" />
          <div className="hidden sm:block">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Crecimiento</p>
            <div className="flex items-center gap-1.5 justify-end">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-xl font-semibold tabular-nums text-emerald-400">Positivo</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
