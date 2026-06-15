'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { formatPEN, labelEstadoPedido } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const ESTADOS = [
  { key: 'pendiente',  label: 'Pendiente',  dot: 'bg-amber-400' },
  { key: 'confirmado', label: 'Confirmado', dot: 'bg-blue-400'  },
  { key: 'programado', label: 'Programado', dot: 'bg-violet-400'},
  { key: 'enviado',    label: 'En camino',  dot: 'bg-sky-400'   },
]

const STATUS_BADGE: Record<string, { dot: string; label: string }> = {
  pendiente:  { dot: 'bg-amber-400',   label: 'Pendiente'  },
  confirmado: { dot: 'bg-blue-400',    label: 'Confirmado' },
  programado: { dot: 'bg-violet-400',  label: 'Programado' },
  enviado:    { dot: 'bg-sky-400',     label: 'En camino'  },
  entregado:  { dot: 'bg-emerald-400', label: 'Entregado'  },
  cancelado:  { dot: 'bg-red-400',     label: 'Cancelado'  },
}

export default function DashboardPipeline() {
  const { data, error, isLoading } = useSWR('/api/dashboard/pipeline', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30000,
  })

  if (isLoading) {
    return <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl h-80 animate-pulse" />
  }

  if (error || !data) return null

  const { pipeline, pedidosRecientes } = data

  const activos = ESTADOS.filter(e => (pipeline[e.key] ?? 0) > 0)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Pedidos en curso</p>
          <Link href="/dashboard/ventas?tab=pedidos" className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Contadores de estado */}
        {activos.length > 0 && (
          <div className="flex divide-x divide-zinc-100 dark:divide-zinc-800 border-b border-zinc-100 dark:border-zinc-800">
            {activos.map(e => (
              <Link
                key={e.key}
                href={`/dashboard/ventas?tab=pedidos&estado=${e.key}`}
                className="flex-1 px-4 py-3 text-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className={`w-2 h-2 rounded-full ${e.dot} shrink-0`} />
                  <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {pipeline[e.key] ?? 0}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{e.label}</p>
              </Link>
            ))}
          </div>
        )}

        {/* Lista de pedidos recientes */}
        {pedidosRecientes.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Sin pedidos activos</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {pedidosRecientes.map((p: any) => {
              const badge = STATUS_BADGE[p.estado] ?? { dot: 'bg-zinc-300', label: labelEstadoPedido(p.estado) }
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/ventas?tab=pedidos&pedido_id=${p.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />
                  <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100 font-medium truncate">
                    {p.nombre_cliente}
                  </span>
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 shrink-0">
                    {p.numero_pedido}
                  </span>
                  {p.total && (
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">
                      {formatPEN(p.total)}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
