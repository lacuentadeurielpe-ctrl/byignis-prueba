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
    <div className={`p-5 rounded-xl border transition-all group ${comingSoon ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/40'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2.5 rounded-lg transition ${comingSoon ? 'bg-zinc-100 group-hover:bg-zinc-100' : 'bg-indigo-50 group-hover:bg-indigo-100'}`}>
            <Icon className={`w-5 h-5 transition ${comingSoon ? 'text-zinc-400' : 'text-indigo-600 group-hover:text-indigo-700'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm transition ${comingSoon ? 'text-zinc-500' : 'text-zinc-900 group-hover:text-indigo-700'}`}>
              {name}
              {comingSoon && <span className="ml-2 text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">Próximamente</span>}
            </h3>
            <p className={`text-xs mt-1.5 ${comingSoon ? 'text-zinc-400' : 'text-zinc-600'}`}>{description}</p>
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
            className="w-full px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg border border-indigo-200 transition-all"
          >
            {actionLabel}
          </button>
        </>
      )}
    </div>
  )
}
