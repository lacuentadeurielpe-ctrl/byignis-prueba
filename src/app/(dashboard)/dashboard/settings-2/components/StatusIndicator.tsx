'use client'

import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react'

type Status = 'conectado' | 'error' | 'expirado' | 'desconectado' | 'pendiente'

interface StatusIndicatorProps {
  status: Status
  message?: string
  alert?: string
}

const STATUS_CONFIG: Record<Status, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
  conectado: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    label: 'Conectado',
  },
  error: {
    icon: <XCircle className="w-5 h-5" />,
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
    label: 'Error',
  },
  expirado: {
    icon: <AlertCircle className="w-5 h-5" />,
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: 'Expirado',
  },
  desconectado: {
    icon: <XCircle className="w-5 h-5" />,
    bg: 'bg-zinc-100 border-zinc-300',
    text: 'text-zinc-600',
    label: 'Desconectado',
  },
  pendiente: {
    icon: <Clock className="w-5 h-5" />,
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    label: 'Pendiente',
  },
}

export default function StatusIndicator({ status, message, alert }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div className={`px-3 py-2 rounded-lg border ${config.bg}`}>
      <div className="flex items-center gap-2">
        <div className={config.text}>{config.icon}</div>
        <div>
          <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
          {message && <p className="text-xs text-zinc-500 mt-0.5">{message}</p>}
          {alert && <p className={`text-xs ${config.text} font-medium mt-0.5`}>{alert}</p>}
        </div>
      </div>
    </div>
  )
}
