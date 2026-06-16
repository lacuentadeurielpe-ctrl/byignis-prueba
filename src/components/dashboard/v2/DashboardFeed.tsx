'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function dotColor(estado: string, type: string): string {
  if (type === 'pago') return estado === 'confirmado_auto' ? 'bg-emerald-400' : 'bg-amber-400'
  if (type === 'cotizacion') return 'bg-zinc-300 dark:bg-zinc-600'
  const map: Record<string, string> = {
    entregado: 'bg-emerald-400',
    enviado: 'bg-sky-400',
    confirmado: 'bg-blue-400',
    programado: 'bg-violet-400',
    pendiente: 'bg-amber-400',
    cancelado: 'bg-red-400',
  }
  return map[estado] ?? 'bg-zinc-300 dark:bg-zinc-600'
}

export default function DashboardFeed() {
  const { data, error, isLoading } = useSWR('/api/dashboard/feed', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 20000,
  })

  if (isLoading) {
    return <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl h-80 animate-pulse" />
  }

  if (error || !data || !Array.isArray(data.feed)) return null

  const { feed } = data

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Actividad reciente</p>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              en vivo
            </span>
          </div>
          <Link href="/dashboard/ventas" className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition flex items-center gap-1">
            Ver más <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Feed */}
        {feed.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Sin actividad reciente</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {feed.map((item: any, idx: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor(item.estado, item.type)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-900 dark:text-zinc-100 font-medium truncate leading-tight">
                      {item.titulo}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                      {item.subtitulo}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 tabular-nums">
                    {tiempoRelativo(item.ts)}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
