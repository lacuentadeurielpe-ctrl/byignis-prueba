'use client'

import { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import IntegrationStatusBadge from './IntegrationStatusBadge'

type Status = 'conectado' | 'error' | 'expirado' | 'desconectado' | 'pruebas'

interface IntegrationCardProps {
  id: string
  name: string
  description: string
  icon: LucideIcon
  status?: Status
  statusMessage?: string
  actionLabel?: string
  onAction?: () => void | Promise<void>
  href?: string
  comingSoon?: boolean
}

export default function IntegrationCard({
  id,
  name,
  description,
  icon: Icon,
  status,
  statusMessage,
  actionLabel = 'Configurar',
  onAction,
  href,
  comingSoon = false,
}: IntegrationCardProps) {
  const router = useRouter()

  const handleClick = () => {
    if (comingSoon) return
    if (onAction) {
      onAction()
    } else if (href) {
      router.push(href)
    }
  }

  return (
    <div className={`p-5 rounded-lg border ${comingSoon ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm'} transition-all`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${comingSoon ? 'bg-zinc-100' : 'bg-indigo-50'}`}>
            <Icon className={`w-5 h-5 ${comingSoon ? 'text-zinc-400' : 'text-indigo-600'}`} />
          </div>
          <div>
            <h3 className={`font-medium text-sm ${comingSoon ? 'text-zinc-500' : 'text-zinc-900'}`}>
              {name}
              {comingSoon && <span className="ml-2 text-xs bg-zinc-200 text-zinc-700 px-2 py-1 rounded">Próximamente</span>}
            </h3>
            <p className={`text-xs mt-1 ${comingSoon ? 'text-zinc-400' : 'text-zinc-600'}`}>{description}</p>
          </div>
        </div>
      </div>

      {!comingSoon && (
        <>
          {status && (
            <div className="mb-4">
              <IntegrationStatusBadge status={status} message={statusMessage} />
            </div>
          )}

          <button
            onClick={handleClick}
            className="w-full px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200 transition-colors"
          >
            {actionLabel}
          </button>
        </>
      )}
    </div>
  )
}
