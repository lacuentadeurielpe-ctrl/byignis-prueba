'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ShoppingCart, Banknote, MessageSquare, ArrowUpRight } from 'lucide-react'
import { cn, formatPEN } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/NumberTicker'
import { motion } from 'framer-motion'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardTitular({ esDueno }: { esDueno: boolean }) {
  const { data, isLoading } = useSWR('/api/dashboard/snapshot', fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 animate-pulse">
        <div className="h-44 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-44 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    )
  }

  if (!data) return null

  const { ingresosHoy, ingresosAyer, cmbHoy, pedidosHoyN, pedidosActivosN, cobrosN, convActivas } = data
  const ticketProm = pedidosHoyN > 0 ? ingresosHoy / pedidosHoyN : 0

  const opItems = [
    {
      icon: ShoppingCart,
      label: 'pedidos en curso',
      value: pedidosActivosN,
      color: pedidosActivosN > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400',
      href: '/dashboard/ventas?tab=pedidos&estado=pendiente',
    },
    {
      icon: Banknote,
      label: 'por cobrar',
      value: cobrosN,
      color: cobrosN > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400',
      href: '/dashboard/ventas?tab=pagos&estado=pendiente_revision',
    },
    {
      icon: MessageSquare,
      label: 'chats pausados',
      value: convActivas,
      color: convActivas > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-400',
      href: '/dashboard/conversations?filtro=pausado',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-3"
    >
      {/* ── DINERO ─────────────────────────────────────────────────────────── */}
      {esDueno ? (
        <Link
          href="/dashboard/ventas?tab=pagos&estado=cobrado"
          className="group relative overflow-hidden rounded-2xl bg-zinc-950 dark:bg-zinc-900 p-6 flex flex-col justify-between min-h-[160px] border border-zinc-800 hover:border-zinc-700 transition"
        >
          {/* Fondo decorativo */}
          <div className="pointer-events-none absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/[0.03]" />
          <div className="pointer-events-none absolute -right-2   top-12 w-28 h-28 rounded-full bg-white/[0.02]" />

          <div className="relative z-10">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Ventas de hoy</p>

            <div className="flex items-end gap-3 mb-2">
              <p className="text-4xl sm:text-5xl font-bold text-white tabular-nums leading-none">
                <NumberTicker value={ingresosHoy} format={formatPEN} />
              </p>
              {cmbHoy && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-lg mb-1',
                  cmbHoy.sube
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                )}>
                  {cmbHoy.sube ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {cmbHoy.pct}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-zinc-500 text-xs">
              <span>vs ayer {formatPEN(ingresosAyer)}</span>
              {ticketProm > 0 && (
                <>
                  <span className="w-px h-3 bg-zinc-700" />
                  <span>Ticket prom. <span className="text-zinc-400 font-semibold">{formatPEN(ticketProm)}</span></span>
                </>
              )}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/60">
            <span className="text-xs text-zinc-600">{pedidosHoyN} pedidos procesados hoy</span>
            <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
        </Link>
      ) : (
        /* Vendedor: ve pedidos de hoy en vez de dinero */
        <Link
          href="/dashboard/ventas?tab=pedidos"
          className="group relative overflow-hidden rounded-2xl bg-zinc-950 dark:bg-zinc-900 p-6 flex flex-col justify-between min-h-[160px] border border-zinc-800 hover:border-zinc-700 transition"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/[0.03]" />
          <div className="relative z-10">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Pedidos de hoy</p>
            <p className="text-5xl font-bold text-white tabular-nums leading-none mb-2">
              <NumberTicker value={pedidosHoyN} />
            </p>
            <p className="text-xs text-zinc-500">{pedidosActivosN} aún en curso</p>
          </div>
          <div className="relative z-10 flex items-center justify-end mt-4 pt-4 border-t border-zinc-800/60">
            <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition" />
          </div>
        </Link>
      )}

      {/* ── OPERACIÓN ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between min-h-[160px]">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Operación ahora</p>

        <div className="space-y-3">
          {opItems.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
              >
                <Link
                  href={item.href}
                  className="flex items-center justify-between group rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 px-3 py-2.5 -mx-3 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn('w-4 h-4 shrink-0', item.color)} />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xl font-bold tabular-nums leading-none', item.value > 0 ? item.color : 'text-zinc-300 dark:text-zinc-600')}>
                      <NumberTicker value={item.value} />
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
