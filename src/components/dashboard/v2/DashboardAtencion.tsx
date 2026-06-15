'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, CheckCircle2, ArrowRight, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type AlertType = 'warning' | 'info' | 'success'

interface InboxAlert {
  id: string
  type: AlertType
  title: string
  description: string
  actionText: string
  href: string
}

const CONFIG: Record<AlertType, {
  icon: React.ElementType
  bar: string
  bg: string
  title: string
  action: string
}> = {
  warning: {
    icon: AlertTriangle,
    bar: 'bg-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40',
    title: 'text-amber-900 dark:text-amber-100',
    action: 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100',
  },
  info: {
    icon: Info,
    bar: 'bg-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40',
    title: 'text-blue-900 dark:text-blue-100',
    action: 'text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100',
  },
  success: {
    icon: CheckCircle2,
    bar: 'bg-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40',
    title: 'text-emerald-900 dark:text-emerald-100',
    action: 'text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100',
  },
}

export default function DashboardAtencion() {
  const { data, isLoading } = useSWR('/api/dashboard/inbox', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-5 w-40 bg-zinc-100 dark:bg-zinc-800 rounded mb-3" />
        <div className="h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700" />
        <div className="h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700" />
      </div>
    )
  }

  const alerts: InboxAlert[] = data?.alerts ?? []

  const header = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Necesita tu atención
        </p>
        {alerts.length > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
            {alerts.length}
          </span>
        )}
      </div>
    </div>
  )

  if (alerts.length === 0) {
    return (
      <div>
        {header}
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
          <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Todo en orden — sin alertas pendientes</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <AnimatePresence>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {alerts.map((alert, idx) => {
            const cfg = CONFIG[alert.type]
            const Icon = cfg.icon
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: idx * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
              >
                <Link
                  href={alert.href}
                  className={cn(
                    'group flex flex-col gap-2 p-4 rounded-2xl border transition hover:shadow-sm relative overflow-hidden',
                    cfg.bg
                  )}
                >
                  {/* Barra lateral de color */}
                  <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl', cfg.bar)} />

                  <div className="flex items-start gap-2.5 pl-2">
                    <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', cfg.title)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-bold leading-snug', cfg.title)}>{alert.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{alert.description}</p>
                    </div>
                  </div>

                  <div className={cn('flex items-center gap-1 text-xs font-semibold pl-2 mt-0.5 transition', cfg.action)}>
                    {alert.actionText}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </AnimatePresence>
    </div>
  )
}
