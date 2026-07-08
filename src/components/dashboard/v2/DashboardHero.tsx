'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { formatPEN } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/NumberTicker'
import { motion } from 'framer-motion'
import ActivityChart from '@/components/dashboard/ActivityChart'
import DashboardGanancias from './DashboardGanancias'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })

export default function DashboardHero({ esDueno, periodo, sucursalId }: { esDueno: boolean; periodo: string; sucursalId?: string }) {
  const query = new URLSearchParams()
  if (periodo) query.set('p', periodo)
  if (sucursalId) query.set('s', sucursalId)
  
  const { data: kpi, error: kpiError, isLoading } = useSWR(`/api/dashboard/kpi?${query.toString()}`, fetcher, { revalidateOnFocus: false })
  const { data: snap } = useSWR('/api/dashboard/snapshot', fetcher, { revalidateOnFocus: false })
  const { data: charts } = useSWR('/api/dashboard/charts', fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-72 rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
        <div className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
      </div>
    )
  }

  if (kpiError || !kpi) return null

  const {
    periodoLabel, perIngresos, totalPerPedidos,
    perEntregados, ticketProm, tasaEntrega,
  } = kpi

  const pedidosActivos = snap?.pedidosActivosN ?? 0
  const cobrosN        = snap?.cobrosN ?? 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">

      {/* ── HERO CARD ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">

        {/* Número principal */}
        <div className="px-6 pt-6 pb-3 flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wider">
              {esDueno ? 'Ingresos' : 'Pedidos'} · {periodoLabel}
            </p>

            {esDueno ? (
              <span className="text-[2.75rem] leading-none font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                <NumberTicker value={perIngresos} format={formatPEN} />
              </span>
            ) : (
              <span className="text-[2.75rem] leading-none font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                <NumberTicker value={totalPerPedidos} />
              </span>
            )}
          </div>
        </div>

        {/* Gráfico 30d */}
        <div className="px-6 pb-5">
          <p className="text-[10px] text-zinc-300 dark:text-zinc-600 uppercase tracking-wider mb-3">Últimos 30 días</p>
          {charts?.chartData ? (
            <ActivityChart datos={charts.chartData} />
          ) : (
            <div className="h-[180px] bg-zinc-50 dark:bg-zinc-800/40 rounded animate-pulse" />
          )}
        </div>
      </div>

      {/* ── SECCION GANANCIAS NETAS (Solo dueños) ──────────────────────── */}
      {esDueno && (
        <DashboardGanancias
          gananciaNeta={kpi.perGanancia ?? 0}
          ingresosTotales={perIngresos}
          periodoLabel={periodoLabel}
        />
      )}

      {/* ── STATS STRIP ──────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 ${esDueno ? 'lg:grid-cols-5' : 'sm:grid-cols-4'} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-x divide-zinc-100 dark:divide-zinc-800`}>

        <Link href="/dashboard/ventas?tab=pedidos" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Pedidos</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">
            {totalPerPedidos > 0 ? totalPerPedidos : <span className="text-zinc-300 dark:text-zinc-600">0</span>}
          </p>
          <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">{periodoLabel.toLowerCase()}</p>
        </Link>

        <Link href="/dashboard/ventas?tab=pedidos&estado=entregado" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Entregados</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">
            {perEntregados > 0 ? perEntregados : <span className="text-zinc-300 dark:text-zinc-600">0</span>}
          </p>
          <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">
            {totalPerPedidos > 0 ? `${tasaEntrega}% del total` : 'sin pedidos'}
          </p>
        </Link>

        {esDueno ? (
          <>
            <Link href="/dashboard/ventas?tab=pedidos" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Ticket prom.</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">
                {ticketProm > 0 ? <NumberTicker value={ticketProm} format={formatPEN} /> : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
              </p>
              <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">por pedido</p>
            </Link>
            <div className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-default">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">G. Neta</p>
              <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
                {kpi.perGanancia > 0 ? <NumberTicker value={kpi.perGanancia} format={formatPEN} /> : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
              </p>
              <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">margen: {perIngresos > 0 ? ((kpi.perGanancia / perIngresos) * 100).toFixed(1) : 0}%</p>
            </div>
          </>
        ) : (
          <Link href="/dashboard/ventas?tab=pedidos&estado=entregado" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Tasa entrega</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">
              {tasaEntrega > 0 ? `${tasaEntrega}%` : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
            </p>
            <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">completados</p>
          </Link>
        )}

        <div className="grid grid-rows-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          <Link href="/dashboard/ventas?tab=pedidos&estado=confirmado" className="px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Activos ahora</p>
              <p className={`text-lg font-semibold tabular-nums leading-none mt-0.5 ${pedidosActivos > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{pedidosActivos}</p>
            </div>
          </Link>
          <Link href="/dashboard/ventas?tab=pagos&estado=pendiente_revision" className="px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Por cobrar</p>
              <p className={`text-lg font-semibold tabular-nums leading-none mt-0.5 ${cobrosN > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{cobrosN}</p>
            </div>
          </Link>
        </div>

      </div>
    </motion.div>
  )
}
