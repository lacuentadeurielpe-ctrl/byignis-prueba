'use client'

import { useDraggable } from '@dnd-kit/core'
import { Settings, GripVertical, Truck, ShoppingBag, Shield, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MiembroEquipo } from './RolesBoard'

interface AssignedChipProps {
  miembro: MiembroEquipo
  localId: string
  onOpenPermisos: (miembro: MiembroEquipo) => void
}

const ROL_ICONS: Record<string, React.ElementType> = {
  vendedor: ShoppingBag,
  repartidor: Truck,
  gerente: Shield,
  admin: Wrench,
  administrador: Wrench,
  dueno: Shield,
}

/** Chip de miembro dentro de una columna de sucursal — arrastrable */
export default function AssignedChip({ miembro, localId, onOpenPermisos }: AssignedChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `assigned-${miembro.id}-${localId}`,
    data: { miembroId: miembro.id, source: localId },
  })

  const RolIcon = ROL_ICONS[miembro.rol.toLowerCase()] ?? Shield

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-all duration-150 group',
        isDragging
          ? 'opacity-40 shadow-none'
          : 'hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm',
      )}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Avatar mini */}
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
        {miembro.nombre.charAt(0).toUpperCase()}
      </div>

      {/* Nombre + rol */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
          {miembro.nombre}
        </p>
        <div className="flex items-center gap-1">
          <RolIcon className="w-2.5 h-2.5 text-zinc-400" />
          <span className="text-[10px] text-zinc-400 capitalize">{miembro.rol}</span>
        </div>
      </div>

      {/* Botón permisos (visible en hover) */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenPermisos(miembro) }}
        className="p-1 text-zinc-300 dark:text-zinc-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        title="Editar permisos"
      >
        <Settings className="w-3 h-3" />
      </button>
    </div>
  )
}
