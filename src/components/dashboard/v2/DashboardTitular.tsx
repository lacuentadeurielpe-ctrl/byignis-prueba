'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ShoppingCart, CheckCircle2, Target, MessageSquare, Banknote, Clock, ArrowUpRight } from 'lucide-react'
import { cn, formatPEN } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/NumberTicker'
import { motion } from 'framer-motion'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardTitular({ esDueno, periodo }: { esDueno: boolean; periodo: string }) {
  // KPI data — respeta el período seleccionado
  const { data: kpi, isLoading: kpiLoading } = useSWR(`/api/dashboard/kpi?p=${periodo}`, fetcher, { revalidateOnFocus: false })
  // Snapshot — siempre en tiempo real (activos ahora mismo)
  const { data: snap } = useSWR('/api/dashboard/snapshot', fetcher, { revalidateOnFocus: false })

  if (kpiLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60" />
      </div>
    )
  }

  if (!kpi) return null

  const {
    periodoLabel,
    totalPerPedidos, perEntregados, perIngresos, perGanancia,
    ticketProm, tasaEntrega, cambios
  } = kpi

  const pedidosActivos = snap?.pedidosActivosN ?? 0
  const cobrosN        = snap?.cobrosN ?? 0
  const convActivas    = snap?.convActivas ?? 0

  const deltaIngresos = cambios?.ingresos

  return (
    <div className="space-y-3">

      {/* ── BLOQUE PRINCIPAL ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* DINERO — 3/5 del ancho */}
        {esDueno ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 relative overflow-hidden rounded-2xl bg-zinc-950 dark:bg-zinc-900 p-6 border border-zinc-800 min-h-[180px] flex flex-col justify-between"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 w-56 h-56 rounded-full bg-white/[0.025]" />
            <div className="pointer-events-none absolute right-8 bottom-4 w-32 h-32 rounded-full bg-white/[0.015]" />

            <div className="relative z-10">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-5">
                Ingresos · {periodoLabel}
              </p>

              <div className="flex items-end gap-3 mb-3">
                <p className="text-4xl sm:text-5xl font-bold text-white tabular-nums leading-none">
                  <NumberTicker value={perIngresos} format={formatPEN} />
                </p>
                {deltaIngresos && (
                  <span className={cn(
                    'inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-lg mb-1 shrink-0',
                    deltaIngresos.sube ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  )}>
                    {deltaIngresos.sube ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {deltaIngresos.pct}% vs anterior
                  </span>
                )}
              </div>

              {perGanancia > 0 && (
                <p className="text-sm text-zinc-500">
                  Ganancia estimada: <span className="text-emerald-400 font-semibold">{formatPEN(perGanancia)}</span>
                </p>
              )}
            </div>

            <Link href="/dashboard/ventas?tab=pagos" className="relative z-10 flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/60 group">
              <span className="text-xs text-zinc-600">{totalPerPedidos} pedidos en este período</span>
              <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition" />
            </Link>
          </motion.div>
        ) : (
          /* Vendedor: ve pedidos del período */
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 relative overflow-hidden rounded-2xl bg-zinc-950 dark:bg-zinc-900 p-6 border border-zinc-800 min-h-[180px] flex flex-col justify-between"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 w-56 h-56 rounded-full bg-white/[0.025]" />
            <div className="relative z-10">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-5">Pedidos · {periodoLabel}</p>
              <p className="text-5xl font-bold text-white tabular-nums leading-none mb-2">
                <NumberTicker value={totalPerPedidos} />
              </p>
              <p className="text-sm text-zinc-500">{perEntregados} entregados · {totalPerPedidos - perEntregados} en proceso</p>
            </div>
          </motion.div>
        )}

        {/* MÉTRICAS RÁPIDAS — 2/5 del ancho */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="lg:col-span-2 grid grid-cols-2 gap-3"
        >
          {/* Pedidos del período */}
          <Link href="/dashboard/ventas?tab=pedidos" className="group rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
              <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums leading-none">
                <NumberTicker value={totalPerPedidos} />
              </p>
              <p className="text-xs text-zinc-400 mt-1">pedidos</p>
            </div>
          </Link>

          {/* Entregados */}
          <Link href="/dashboard/ventas?tab=pedidos&estado=entregado" className="group rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums leading-none">
                <NumberTicker value={perEntregados} />
              </p>
              <p className="text-xs text-zinc-400 mt-1">entregados</p>
            </div>
          </Link>

          {/* Ticket promedio */}
          {esDueno && (
            <Link href="/dashboard/ventas?tab=pedidos" className="group rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition">
              <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mb-3">
                <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums leading-none">
                  {ticketProm > 0 ? <NumberTicker value={ticketProm} format={formatPEN} /> : '—'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">ticket prom.</p>
              </div>
            </Link>
          )}

          {/* Tasa de entrega */}
          <Link href="/dashboard/ventas?tab=pedidos&estado=entregado" className="group rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-3">
              <Banknote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums leading-none">
                {tasaEntrega > 0 ? `${tasaEntrega}%` : '—'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">completados</p>
            </div>
          </Link>
        </motion.div>
      </div>

      {/* ── FRANJA TIEMPO REAL ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3"
      >
        <Link
          href="/dashboard/ventas?tab=pedidos&estado=confirmado"
          className="group flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
        >
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', pedidosActivos > 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-zinc-50 dark:bg-zinc-800')}>
            <Clock className={cn('w-4 h-4', pedidosActivos > 0 ? 'text-blue-500' : 'text-zinc-400')} />
          </div>
          <div className="min-w-0">
            <p className={cn('text-xl font-bold tabular-nums leading-none', pedidosActivos > 0 ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-300 dark:text-zinc-600')}>
              {pedidosActivos}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">activos ahora</p>
          </div>
        </Link>

        <Link
          href="/dashboard/ventas?tab=pagos&estado=pendiente_revision"
          className="group flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
        >
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', cobrosN > 0 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-zinc-50 dark:bg-zinc-800')}>
            <Banknote className={cn('w-4 h-4', cobrosN > 0 ? 'text-amber-500' : 'text-zinc-400')} />
          </div>
          <div className="min-w-0">
            <p className={cn('text-xl font-bold tabular-nums leading-none', cobrosN > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-300 dark:text-zinc-600')}>
              {cobrosN}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">por cobrar</p>
          </div>
        </Link>

        <Link
          href="/dashboard/conversations?filtro=pausado"
          className="group flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
        >
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', convActivas > 0 ? 'bg-sky-50 dark:bg-sky-900/30' : 'bg-zinc-50 dark:bg-zinc-800')}>
            <MessageSquare className={cn('w-4 h-4', convActivas > 0 ? 'text-sky-500' : 'text-zinc-400')} />
          </div>
          <div className="min-w-0">
            <p className={cn('text-xl font-bold tabular-nums leading-none', convActivas > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-300 dark:text-zinc-600')}>
              {convActivas}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">chats pausados</p>
          </div>
        </Link>
      </motion.div>

    </div>
  )
}
