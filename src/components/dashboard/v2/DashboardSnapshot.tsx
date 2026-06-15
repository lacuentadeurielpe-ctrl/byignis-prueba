'use client'

import useSWR from 'swr'
import { Zap, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { cn, formatPEN } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/NumberTicker'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardSnapshot({ esDueno }: { esDueno: boolean }) {
  const { data, error, isLoading } = useSWR('/api/dashboard/snapshot', fetcher, {
    revalidateOnFocus: false, // Se actualizará via WebSockets después
  })

  if (isLoading) {
    return (
      <div className="bg-zinc-950 rounded-2xl p-5 text-white overflow-hidden h-36 animate-pulse">
        <div className="w-1/4 h-4 bg-zinc-800 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-zinc-800 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <div className="bg-zinc-950 rounded-2xl p-5 text-white">Error al cargar resumen.</div>
  }

  const { ingresosHoy, cmbHoy, pedidosHoyN, pedidosActivosN, cobrosN, convActivas } = data

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl p-5 text-zinc-900 dark:text-white overflow-hidden relative shadow-sm border border-zinc-200 dark:border-zinc-800 transition-ui">
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50 dark:opacity-100">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-zinc-100 dark:bg-white/[0.03]" />
        <div className="absolute -right-4   top-8  w-24 h-24 rounded-full bg-zinc-100 dark:bg-white/[0.03]" />
      </div>
      <div className="flex items-center gap-2 mb-4 relative z-10">
        <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Resumen de hoy</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
        <Link href={esDueno ? "/dashboard/ventas?tab=pagos&estado=cobrado" : "/dashboard/ventas?tab=pedidos"} className="group p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition cursor-pointer backdrop-blur-sm border border-zinc-200/50 dark:border-white/5">
          <p className="text-2xl sm:text-3xl font-bold tabular-nums">
            {esDueno ? <NumberTicker value={ingresosHoy} format={formatPEN} /> : <NumberTicker value={pedidosHoyN} />}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <p className="text-xs text-zinc-500">{esDueno ? 'ingresos hoy' : 'pedidos hoy'}</p>
            {esDueno && cmbHoy && (
              <span className={cn('text-xs font-semibold flex items-center gap-0.5', cmbHoy.sube ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                {cmbHoy.sube ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                {cmbHoy.pct}%
              </span>
            )}
          </div>
        </Link>
        
        <Link href="/dashboard/ventas?tab=pedidos&estado=pendiente" className="group p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition cursor-pointer backdrop-blur-sm border border-zinc-200/50 dark:border-white/5">
          <p className="text-2xl sm:text-3xl font-bold tabular-nums"><NumberTicker value={pedidosActivosN} /></p>
          <p className="text-xs text-zinc-500 mt-1">pedidos en curso</p>
        </Link>
        
        <Link href="/dashboard/ventas?tab=pagos&estado=pendiente_revision" className="group p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition cursor-pointer backdrop-blur-sm border border-zinc-200/50 dark:border-white/5">
          <p className={cn('text-2xl sm:text-3xl font-bold tabular-nums', cobrosN > 0 ? 'text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]' : '')}><NumberTicker value={cobrosN} /></p>
          <p className="text-xs text-zinc-500 mt-1">por cobrar hoy</p>
        </Link>
        
        <Link href="/dashboard/conversations?filtro=pausado" className="group p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition cursor-pointer backdrop-blur-sm border border-zinc-200/50 dark:border-white/5">
          <p className={cn('text-2xl sm:text-3xl font-bold tabular-nums', convActivas > 0 ? 'text-sky-500 dark:text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]' : '')}><NumberTicker value={convActivas} /></p>
          <p className="text-xs text-zinc-500 mt-1">chats pausados</p>
        </Link>
      </div>
    </div>
  )
}
