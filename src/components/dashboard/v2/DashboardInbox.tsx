'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ArrowRight, Info, CheckCircle2 } from 'lucide-react'
import { HoverSpotlightCard } from '@/components/ui/HoverSpotlightCard'
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

export default function DashboardInbox() {
  const { data, error, isLoading } = useSWR('/api/dashboard/inbox', fetcher, { 
    revalidateOnFocus: false,
    refreshInterval: 60000 // Refresca cada minuto
  })

  if (isLoading || error || !data) return null

  const alerts: InboxAlert[] = data.alerts ?? []

  if (alerts.length === 0) return null

  const ICONS: Record<AlertType, any> = {
    warning: AlertCircle,
    info: Info,
    success: CheckCircle2,
  }

  const COLORS: Record<AlertType, string> = {
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50',
    info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50',
  }

  const ICON_COLORS: Record<AlertType, string> = {
    warning: 'text-yellow-600 dark:text-yellow-500',
    info: 'text-blue-600 dark:text-blue-500',
    success: 'text-emerald-600 dark:text-emerald-500',
  }

  return (
    <div className="mb-6 space-y-3">
      <AnimatePresence>
        {alerts.map((alert, idx) => {
          const Icon = ICONS[alert.type] || Info
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
            >
              <Link href={alert.href} className="block group">
                <HoverSpotlightCard className={cn('p-4 flex items-start gap-4 transition', COLORS[alert.type])}>
                  <div className="mt-0.5 shrink-0">
                    <Icon className={cn('w-5 h-5', ICON_COLORS[alert.type])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold tracking-tight">{alert.title}</h4>
                    <p className="text-sm mt-0.5 opacity-90">{alert.description}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-sm font-semibold opacity-80 group-hover:opacity-100 transition mt-1 sm:mt-0">
                    {alert.actionText}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </HoverSpotlightCard>
              </Link>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
