'use client'

import { useDraggable } from '@dnd-kit/core'
import { Truck, ShoppingBag, Shield, Wrench, GripVertical, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MiembroEquipo } from './RolesBoard'

interface WorkerCardProps {
  miembro: MiembroEquipo
  sucursalNombre?: string | null
  onOpenPermisos: (miembro: MiembroEquipo) => void
  isDragging?: boolean
}

const ROL_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  vendedor:      { label: 'Vendedor',       icon: ShoppingBag, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  repartidor:    { label: 'Repartidor',     icon: Truck,        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  gerente:       { label: 'Gerente',        icon: Shield,       color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  admin:         { label: 'Admin',          icon: Wrench,       color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  administrador: { label: 'Admin',          icon: Wrench,       color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  dueno:         { label: 'Dueño',          icon: Shield,       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
}

function getRolConfig(rol: string) {
  return ROL_CONFIG[rol.toLowerCase()] ?? { label: rol, icon: Shield, color: 'bg-zinc-100 text-zinc-600' }
}

/** Card de trabajador en el pool izquierdo — arrastrable */
export default function WorkerCard({ miembro, sucursalNombre, onOpenPermisos, isDragging }: WorkerCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging: dndDragging } = useDraggable({
    id: `pool-${miembro.id}`,
    data: { miembroId: miembro.id, source: 'pool' },
  })

  const rolConfig = getRolConfig(miembro.rol)
  const RolIcon = rolConfig.icon

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3.5 transition-all duration-150 group',
        dndDragging || isDragging
          ? 'opacity-40 scale-95'
          : 'hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-colors shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
          {miembro.nombre.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
            {miembro.nombre}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', rolConfig.color)}>
              <RolIcon className="w-2.5 h-2.5" />
              {rolConfig.label}
            </span>
            {sucursalNombre && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                · {sucursalNombre}
              </span>
            )}
          </div>
        </div>

        {/* Botón permisos */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenPermisos(miembro) }}
          className="p-1.5 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
          title="Editar permisos"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
