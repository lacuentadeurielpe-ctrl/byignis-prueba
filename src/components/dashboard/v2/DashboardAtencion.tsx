'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, ArrowRight, CheckCircle2 } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })

type AlertType = 'warning' | 'info' | 'success'

interface InboxAlert {
  id: string
  type: AlertType
  title: string
  description: string
  actionText: string
  href: string
}

const STYLE: Record<AlertType, { border: string; dot: string; icon: React.ElementType; iconColor: string }> = {
  warning: {
    border: 'border-l-amber-400',
    dot: 'bg-amber-400',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  info: {
    border: 'border-l-blue-400',
    dot: 'bg-blue-400',
    icon: Info,
    iconColor: 'text-blue-500',
  },
  success: {
    border: 'border-l-emerald-400',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
  },
}

export default function DashboardAtencion() {
  const { data, isLoading } = useSWR('/api/dashboard/inbox', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden animate-pulse">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="h-3 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[1, 2].map(i => (
            <div key={i} className="px-5 py-4 h-14 bg-zinc-50 dark:bg-zinc-800/30" />
          ))}
        </div>
      </div>
    )
  }

  const alerts: InboxAlert[] = data?.alerts ?? []

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Necesita atención
            </p>
            {alerts.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {alerts.length}
              </span>
            )}
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin alertas — todo en orden</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {alerts.map((alert, idx) => {
              const s = STYLE[alert.type]
              const Icon = s.icon
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link
                    href={alert.href}
                    className={`group flex items-center gap-4 px-5 py-3.5 border-l-2 ${s.border} hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${s.iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                        {alert.title}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug truncate">
                        {alert.description}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 flex items-center gap-1 shrink-0 transition-colors">
                      {alert.actionText}
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
