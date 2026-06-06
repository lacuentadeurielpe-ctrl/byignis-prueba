'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ActivityChart from '@/components/dashboard/ActivityChart'
import { motion } from 'framer-motion'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardCharts() {
  const { data, error, isLoading } = useSWR('/api/dashboard/charts', fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-zinc-100 p-5 h-64 animate-pulse" />
  }

  if (error || !data) return <div className="bg-white rounded-2xl border border-zinc-100 p-5">Error cargando gráficos</div>

  const { chartData, topProductos } = data

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Últimos 30 días</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Link href="/dashboard/ventas?tab=pedidos" className="lg:col-span-2 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-100 dark:border-zinc-800/50 p-5 hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-sm transition block group">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Tendencia de actividad</h3>
          <ActivityChart datos={chartData} />
        </Link>

        <div className="bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-100 dark:border-zinc-800/50 p-5 hover:shadow-sm transition">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Más cotizados (30d)</h3>
            <Link href="/dashboard/catalog" className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition font-medium flex items-center gap-0.5 group">
              Ver catálogo <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          {topProductos.length === 0 ? (
            <p className="text-xs text-zinc-300 dark:text-zinc-600 text-center py-4">Sin datos aún</p>
          ) : (
            <div className="space-y-4">
              {topProductos.map((prod: any, i: number) => {
                const max = topProductos[0].cantidad
                const pct = Math.round((prod.cantidad / max) * 100)
                return (
                  <Link key={prod.nombre} href="/dashboard/catalog" className="block group hover:opacity-80 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1 mr-2 leading-tight">
                        <span className="text-zinc-300 dark:text-zinc-600 mr-1.5 font-semibold text-[10px]">#{i + 1}</span>
                        {prod.nombre}
                      </span>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 shrink-0 tabular-nums">{prod.cantidad}</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${pct}%` }} 
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="bg-gradient-to-r from-zinc-800 to-zinc-600 dark:from-zinc-100 dark:to-zinc-300 h-1.5 rounded-full" 
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
