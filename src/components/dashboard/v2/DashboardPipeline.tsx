'use client'

import useSWR from 'swr'
import { Clock, CheckCircle2, Package, Truck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn, labelEstadoPedido } from '@/lib/utils'
import { motion } from 'framer-motion'
import { HoverSpotlightCard } from '@/components/ui/HoverSpotlightCard'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const ESTADOS_PIPELINE = [
  { key: 'pendiente',      label: 'Pendiente',  icon: Clock,        bg: 'bg-amber-50 dark:bg-amber-900/30',   dot: 'bg-amber-400 dark:bg-amber-500',   text: 'text-amber-700 dark:text-amber-400'  },
  { key: 'confirmado',     label: 'Confirmado', icon: CheckCircle2, bg: 'bg-sky-50 dark:bg-sky-900/30',     dot: 'bg-sky-400 dark:bg-sky-500',     text: 'text-sky-700 dark:text-sky-400'    },
  { key: 'en_preparacion', label: 'Preparando', icon: Package,      bg: 'bg-violet-50 dark:bg-violet-900/30',  dot: 'bg-violet-400 dark:bg-violet-500',  text: 'text-violet-700 dark:text-violet-400' },
  { key: 'listo_para_recojo',label: 'Listo Recojo',icon: Package,   bg: 'bg-teal-50 dark:bg-teal-900/30',    dot: 'bg-teal-400 dark:bg-teal-500',    text: 'text-teal-700 dark:text-teal-400'   },
  { key: 'enviado',        label: 'En camino',  icon: Truck,        bg: 'bg-blue-50 dark:bg-blue-900/30',    dot: 'bg-blue-400 dark:bg-blue-500',    text: 'text-blue-700 dark:text-blue-400'   },
  { key: 'entregado',      label: 'Entregado',  icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', dot: 'bg-emerald-400 dark:bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400'},
]

export default function DashboardPipeline() {
  const { data, error, isLoading } = useSWR('/api/dashboard/pipeline', fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-zinc-100 p-5 h-96 animate-pulse" />
  }

  if (error || !data) return <div className="bg-white rounded-2xl border border-zinc-100 p-5">Error cargando pipeline</div>

  const { pipeline, pedidosRecientes } = data
  const totalPipeline = Object.values(pipeline as Record<string, number>).reduce((s, n) => s + n, 0) || 1

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="h-full">
      <HoverSpotlightCard className="h-full p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Estado de pedidos</h3>
          <Link href="/dashboard/ventas?tab=pedidos" className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition flex items-center gap-0.5 font-medium group">
            Ver todos <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

      <div className="space-y-2 mb-4">
        {ESTADOS_PIPELINE.map((estado, idx) => {
          const count = pipeline[estado.key] ?? 0
          const pct   = Math.round((count / totalPipeline) * 100)
          const Icon  = estado.icon
          return (
            <Link key={estado.key} href="/dashboard/ventas?tab=pedidos" className="flex items-center gap-3 group hover:opacity-80 transition block">
              <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', estado.bg)}>
                <Icon className={cn('w-3.5 h-3.5', estado.text)} />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{estado.label}</span>
                  <span className={cn('text-xs font-bold tabular-nums', count > 0 ? estado.text : 'text-zinc-300 dark:text-zinc-600')}>{count}</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: count > 0 ? `${Math.max(pct, 4)}%` : '0%' }} 
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className={cn('h-1.5 rounded-full', estado.dot)} 
                  />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="border-t border-zinc-50 dark:border-zinc-800/50 pt-3 space-y-1.5 mt-auto relative z-10">
        {pedidosRecientes.length === 0 ? (
          <p className="text-xs text-zinc-300 dark:text-zinc-600 text-center py-2">Sin pedidos en curso</p>
        ) : pedidosRecientes.map((p: any) => (
          <Link key={p.id} href="/dashboard/ventas?tab=pedidos" className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition group">
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{p.nombre_cliente}</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="text-zinc-400 dark:text-zinc-500 shrink-0">{p.numero_pedido}</span>
            </div>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ml-2 group-hover:shadow-sm transition',
              ESTADOS_PIPELINE.find(e => e.key === p.estado)?.bg ?? 'bg-zinc-100 dark:bg-zinc-800',
              ESTADOS_PIPELINE.find(e => e.key === p.estado)?.text ?? 'text-zinc-600 dark:text-zinc-400',
            )}>
              {labelEstadoPedido(p.estado)}
            </span>
          </Link>
        ))}
      </div>
      </HoverSpotlightCard>
    </motion.div>
  )
}
