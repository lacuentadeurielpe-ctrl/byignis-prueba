'use client'

import useSWR from 'swr'
import { Zap, ShoppingCart, FileText, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

function colorFeed(estado: string, type: string): string {
  if (type === 'pago') return estado === 'confirmado_auto' ? 'bg-emerald-400' : estado === 'pendiente_revision' ? 'bg-amber-400' : 'bg-zinc-300'
  if (type === 'cotizacion') return 'bg-zinc-400'
  const map: Record<string, string> = { entregado: 'bg-emerald-400', enviado: 'bg-blue-400', listo_para_recojo: 'bg-teal-400', en_preparacion: 'bg-violet-400', confirmado: 'bg-sky-400', pendiente: 'bg-amber-400', cancelado: 'bg-red-400' }
  return map[estado] ?? 'bg-zinc-300'
}

function iconFeed(type: string) {
  if (type === 'pedido') return ShoppingCart
  if (type === 'cotizacion') return FileText
  return CreditCard
}

export default function DashboardFeed() {
  const { data, error, isLoading } = useSWR('/api/dashboard/feed', fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-zinc-100 p-5 h-96 animate-pulse" />
  }

  if (error || !data) return <div className="bg-white rounded-2xl border border-zinc-100 p-5">Error cargando feed</div>

  const { feed } = data

  return (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-zinc-100 p-5 hover:shadow-sm transition">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">Actividad reciente</h3>
        <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          en vivo
        </span>
      </div>

      {feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-zinc-300" />
          </div>
          <p className="text-sm text-zinc-400">Sin actividad reciente</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-zinc-100 via-zinc-200 to-transparent" />
          <div className="space-y-1.5">
            {feed.map((item: any, idx: number) => {
              const Icon = iconFeed(item.type)
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Link href={item.href} className="flex items-start gap-3 relative group rounded-xl hover:bg-zinc-50 px-1.5 py-1.5 transition">
                    <div className={cn('w-[22px] h-[22px] rounded-full border-2 border-white shrink-0 flex items-center justify-center shadow-sm z-10 group-hover:scale-110 transition', colorFeed(item.estado, item.type))}>
                      <Icon className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-800 truncate">{item.titulo}</p>
                        <p className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">{tiempoRelativo(item.ts)}</p>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.subtitulo}</p>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}
