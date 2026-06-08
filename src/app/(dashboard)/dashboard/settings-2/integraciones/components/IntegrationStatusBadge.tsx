'use client'

import { Check, AlertCircle, Clock, AlertTriangle, Plug } from 'lucide-react'

type Status = 'conectado' | 'error' | 'expirado' | 'desconectado' | 'pruebas'

interface StatusConfig {
  icon: React.ReactNode
  label: string
  color: string
  bgColor: string
}

const STATUS_CONFIG: Record<Status, StatusConfig> = {
  conectado: {
    icon: <Check className="w-4 h-4" />,
    label: 'Conectado',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'Error',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50 border-rose-200',
  },
  expirado: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Expirado',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  desconectado: {
    icon: <Plug className="w-4 h-4" />,
    label: 'Desconectado',
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-50 border-zinc-200',
  },
  pruebas: {
    icon: <Clock className="w-4 h-4" />,
    label: 'En Pruebas',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
}

interface IntegrationStatusBadgeProps {
  status: Status
  message?: string
}

export default function IntegrationStatusBadge({ status, message }: IntegrationStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium ${config.bgColor} shadow-sm`}>
      <span className={`${config.color} flex-shrink-0`}>{config.icon}</span>
      <span className={config.color}>{config.label}</span>
      {message && <span className="text-xs text-zinc-500 ml-1">({message})</span>}
    </div>
  )
}
