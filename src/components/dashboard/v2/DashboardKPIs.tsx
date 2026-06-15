'use client'

import useSWR from 'swr'
import { ShoppingCart, Banknote, Target, Truck, Users, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { cn, formatPEN } from '@/lib/utils'
import { motion } from 'framer-motion'
import { NumberTicker } from '@/components/ui/NumberTicker'
import { HoverSpotlightCard } from '@/components/ui/HoverSpotlightCard'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardKPIs({ esDueno, periodo }: { esDueno: boolean; periodo: string }) {
  const { data, error, isLoading } = useSWR(`/api/dashboard/kpi?p=${periodo}`, fetcher, {
    revalidateOnFocus: false,
  })

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="w-28 h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="w-16 h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) return null

  const {
    periodoLabel, totalPerPedidos, perEntregados, perIngresos, perGanancia,
    ticketProm, tasaEntrega, clientesNuevosPer, convPer, convActivas, cambios
  } = data

  // description = qué significa en lenguaje humano
  const kpiCards = [
    {
      label: 'Pedidos',
      description: 'clientes que compraron',
      rawVal: totalPerPedidos,
      isCurrency: false,
      sub: `${perEntregados} ya entregados`,
      delta: cambios.pedidos,
      icon: ShoppingCart,
      accent: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
      visible: true,
      href: '/dashboard/ventas?tab=pedidos',
    },
    {
      label: 'Ingresos',
      description: 'dinero que entró',
      rawVal: perIngresos,
      isCurrency: true,
      sub: esDueno && perGanancia > 0 ? `Ganancia: ${formatPEN(perGanancia)}` : 'ventas confirmadas',
      delta: cambios.ingresos,
      icon: Banknote,
      accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
      visible: esDueno,
      href: '/dashboard/ventas?tab=pagos',
    },
    {
      label: 'Ticket promedio',
      description: 'cuánto gasta c/cliente',
      rawVal: ticketProm,
      isCurrency: true,
      sub: 'por pedido en promedio',
      delta: cambios.ticket,
      icon: Target,
      accent: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400',
      visible: esDueno,
      href: '/dashboard/ventas?tab=pedidos',
    },
    {
      label: '% Completados',
      description: 'pedidos que llegaron',
      rawVal: tasaEntrega,
      isCurrency: false,
      format: (v: number) => `${v}%`,
      sub: `${perEntregados} de ${totalPerPedidos} pedidos`,
      delta: cambios.tasa,
      icon: Truck,
      accent: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
      visible: true,
      href: '/dashboard/ventas?tab=pedidos&estado=entregado',
    },
    {
      label: 'Clientes nuevos',
      description: 'compraron por primera vez',
      rawVal: clientesNuevosPer ?? 0,
      isCurrency: false,
      sub: 'en este período',
      delta: cambios.clientes,
      icon: Users,
      accent: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400',
      visible: esDueno,
      href: '/dashboard/clientes',
    },
    {
      label: 'Chats WhatsApp',
      description: 'consultas por WhatsApp',
      rawVal: convPer ?? 0,
      isCurrency: false,
      sub: `${convActivas ?? 0} esperan respuesta`,
      delta: cambios.conv,
      icon: MessageSquare,
      accent: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400',
      visible: true,
      href: '/dashboard/conversations',
    },
  ].filter(k => k.visible)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Métricas detalladas</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{periodoLabel}</p>
      </div>

      <div className={cn('grid gap-3', kpiCards.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6')}>
        {kpiCards.map((k, idx) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 + 0.1 }}>
            <HoverSpotlightCard className="group h-full">
              <Link href={k.href} className="block p-4 relative z-10 h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-white to-zinc-50/50 dark:from-zinc-900 dark:to-zinc-950/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

                {/* Ícono + label */}
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', k.accent)}>
                    <k.icon className="w-3.5 h-3.5" />
                  </div>
                  {k.delta && (
                    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold', k.delta.sube ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                      {k.delta.sube ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {k.delta.pct}%
                    </span>
                  )}
                </div>

                {/* Número principal */}
                <p className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight tabular-nums leading-none relative z-10 mb-1">
                  {k.rawVal === 0 ? (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  ) : (
                    <NumberTicker value={k.rawVal} format={k.isCurrency ? formatPEN : (k as any).format} />
                  )}
                </p>

                {/* Nombre del KPI */}
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 relative z-10 leading-tight">{k.label}</p>

                {/* Descripción humana */}
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 relative z-10 mt-0.5 leading-tight">{k.description}</p>

                {/* Sub-dato */}
                <p className="text-[10px] text-zinc-300 dark:text-zinc-600 relative z-10 mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-2 truncate">{k.sub}</p>
              </Link>
            </HoverSpotlightCard>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
