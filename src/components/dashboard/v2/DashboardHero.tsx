'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatPEN } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/NumberTicker'
import { motion } from 'framer-motion'
import ActivityChart from '@/components/dashboard/ActivityChart'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })

export default function DashboardHero({ esDueno, periodo }: { esDueno: boolean; periodo: string }) {
  const { data: kpi, error: kpiError, isLoading } = useSWR(`/api/dashboard/kpi?p=${periodo}`, fetcher, { revalidateOnFocus: false })
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
    perEntregados, ticketProm, tasaEntrega, cambios,
  } = kpi

  const pedidosActivos = snap?.pedidosActivosN ?? 0
  const cobrosN        = snap?.cobrosN ?? 0
  const deltaIngresos  = cambios?.ingresos

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
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-[2.75rem] leading-none font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                  <NumberTicker value={perIngresos} format={formatPEN} />
                </span>
                {deltaIngresos && (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${
                    deltaIngresos.sube
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900'
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900'
                  }`}>
                    {deltaIngresos.sube ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {deltaIngresos.pct}% vs período anterior
                  </span>
                )}
              </div>
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

      {/* ── STATS STRIP ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-x divide-zinc-100 dark:divide-zinc-800">

        <Link href="/dashboard/ventas?tab=pedidos" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Pedidos</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">{totalPerPedidos}</p>
          {cambios?.pedidos ? (
            <p className={`text-xs mt-1.5 font-medium ${cambios.pedidos.sube ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {cambios.pedidos.sube ? '↑' : '↓'} {cambios.pedidos.pct}%
            </p>
          ) : <p className="text-xs mt-1.5 text-zinc-300 dark:text-zinc-600">—</p>}
        </Link>

        <Link href="/dashboard/ventas?tab=pedidos&estado=entregado" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Entregados</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">{perEntregados}</p>
          <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">{tasaEntrega}% del total</p>
        </Link>

        {esDueno ? (
          <Link href="/dashboard/ventas?tab=pedidos" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Ticket prom.</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">
              {ticketProm > 0 ? <NumberTicker value={ticketProm} format={formatPEN} /> : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
            </p>
            <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">por pedido</p>
          </Link>
        ) : (
          <Link href="/dashboard/ventas?tab=pedidos&estado=entregado" className="group px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-wider">Tasa entrega</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums leading-none">{tasaEntrega}%</p>
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
