'use client'

import { useDroppable } from '@dnd-kit/core'
import { Building2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import AssignedChip from './AssignedChip'
import type { MiembroEquipo, LocalEquipo } from './RolesBoard'

interface SucursalColumnProps {
  local: LocalEquipo
  miembros: MiembroEquipo[]
  onOpenPermisos: (miembro: MiembroEquipo) => void
  /** Deshabilitar drop zone (usado para el local virtual 'principal' sin DB) */
  disabled?: boolean
}

/** Drop zone de una sucursal — recibe chips arrastrados */
export default function SucursalColumn({ local, miembros, onOpenPermisos, disabled }: SucursalColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: local.id, disabled })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-2xl border-2 transition-all duration-200 min-h-[180px]',
        isOver
          ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-900/20 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-3 border-b rounded-t-2xl',
        isOver
          ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30'
          : 'border-zinc-100 dark:border-zinc-800',
      )}>
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          local.es_principal
            ? 'bg-amber-100 dark:bg-amber-900/40'
            : 'bg-indigo-100 dark:bg-indigo-900/40',
        )}>
          {local.es_principal
            ? <Star className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            : <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{local.nombre}</p>
          {local.es_principal && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Principal</p>
          )}
        </div>
        <span className={cn(
          'text-xs font-bold px-2 py-0.5 rounded-full shrink-0',
          local.es_principal
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
        )}>
          {miembros.length}
        </span>
      </div>

      {/* Chips de miembros asignados */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        {miembros.map(miembro => (
          <AssignedChip
            key={`${miembro.id}-${local.id}`}
            miembro={miembro}
            localId={local.id}
            onOpenPermisos={onOpenPermisos}
          />
        ))}

        {/* Drop hint */}
        {isOver && (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 text-xs font-medium">
            Soltar aquí
          </div>
        )}

        {miembros.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center py-6 text-xs text-zinc-400 dark:text-zinc-600">
            Arrastra miembros aquí
          </div>
        )}
      </div>
    </div>
  )
}
