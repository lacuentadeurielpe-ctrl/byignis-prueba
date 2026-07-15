'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Users, DollarSign, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MiembroEquipo, LocalEquipo } from './roles/RolesBoard'
import PagosPlaceholder from './pagos/PagosPlaceholder'

// [FIX #16] Importación dinámica real: evita cargar @dnd-kit en el bundle del tab de Pagos
const RolesBoard = dynamic(() => import('./roles/RolesBoard'), { ssr: false })

type Tab = 'roles' | 'pagos'

interface EquipoTabsProps {
  miembros: MiembroEquipo[]
  locales: LocalEquipo[]
}

export default function EquipoTabs({ miembros, locales }: EquipoTabsProps) {
  const [tab, setTab] = useState<Tab>('roles')

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'roles',
      label: 'Roles y Sucursales',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'pagos',
      label: 'Pagos y Asistencia',
      icon: <DollarSign className="w-4 h-4" />,
      badge: 'Próximamente',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              tab === t.id
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300',
            )}
          >
            {t.icon}
            {t.label}
            {t.badge && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full leading-none">
                <Lock className="w-2.5 h-2.5" />
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'roles' && (
        <RolesBoard miembros={miembros} locales={locales} />
      )}
      {tab === 'pagos' && (
        <PagosPlaceholder />
      )}
    </div>
  )
}
