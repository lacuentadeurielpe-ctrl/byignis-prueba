'use client'

import useSWR from 'swr'
import { ShoppingCart, Banknote, Target, Truck, Users, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { cn, formatPEN } from '@/lib/utils'
import { motion } from 'framer-motion'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardKPIs({ esDueno, periodo }: { esDueno: boolean, periodo: string }) {
  const { data, error, isLoading } = useSWR(`/api/dashboard/kpi?p=${periodo}`, fetcher, {
    revalidateOnFocus: false, // Update via Realtime
  })

  if (isLoading) {
    return (
      <div>
        <div className="w-24 h-4 bg-zinc-200 rounded mb-3 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-zinc-100 animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error || !data) return <div>Error cargando KPIs.</div>

  const { periodoLabel, totalPerPedidos, perEntregados, perIngresos, perGanancia, ticketProm, tasaEntrega, clientesNuevosPer, convPer, convActivas, cambios } = data

  const kpiCards = [
    { label: 'Pedidos', valor: String(totalPerPedidos), sub: `${perEntregados} entregados`, delta: cambios.pedidos, icon: ShoppingCart, accent: 'text-blue-500 bg-blue-50', visible: true, href: '/dashboard/ventas?tab=pedidos' },
    { label: 'Ingresos', valor: formatPEN(perIngresos), sub: esDueno && perGanancia > 0 ? `Gan. ${formatPEN(perGanancia)}` : ' ', delta: cambios.ingresos, icon: Banknote, accent: 'text-emerald-600 bg-emerald-50', visible: esDueno, href: '/dashboard/ventas?tab=pagos' },
    { label: 'Ticket prom.', valor: ticketProm > 0 ? formatPEN(ticketProm) : '—', sub: 'por pedido', delta: cambios.ticket, icon: Target, accent: 'text-violet-600 bg-violet-50', visible: esDueno, href: '/dashboard/ventas?tab=pedidos' },
    { label: 'Tasa entrega', valor: tasaEntrega > 0 ? `${tasaEntrega}%` : '—', sub: `${perEntregados} de ${totalPerPedidos}`, delta: cambios.tasa, icon: Truck, accent: 'text-amber-600 bg-amber-50', visible: true, href: '/dashboard/ventas?tab=pedidos' },
    { label: 'Clientes nuevos', valor: String(clientesNuevosPer ?? 0), sub: 'del período', delta: cambios.clientes, icon: Users, accent: 'text-sky-600 bg-sky-50', visible: esDueno, href: '/dashboard/clientes' },
    { label: 'Conversaciones', valor: String(convPer ?? 0), sub: `${convActivas ?? 0} pausadas`, delta: cambios.conv, icon: MessageSquare, accent: 'text-zinc-600 bg-zinc-100', visible: true, href: '/dashboard/conversations' },
  ].filter(k => k.visible)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">{periodoLabel}</p>
      <div className={cn('grid gap-3', kpiCards.length <= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6')}>
        {kpiCards.map((k, idx) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 + 0.1 }}>
            <Link href={k.href} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-zinc-100 p-4 hover:border-zinc-300 hover:shadow-sm transition group block relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white to-zinc-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3 relative z-10">
                <p className="text-xs font-medium text-zinc-400 leading-tight">{k.label}</p>
                <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110', k.accent)}>
                  <k.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight tabular-nums leading-none relative z-10">{k.valor}</p>
              <div className="flex items-center gap-2 mt-2 relative z-10">
                <p className="text-xs text-zinc-400 truncate">{k.sub}</p>
                {k.delta && (
                  <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold shrink-0', k.delta.sube ? 'text-emerald-600' : 'text-red-500')}>
                    {k.delta.sube ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                    {k.delta.pct}%
                  </span>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
