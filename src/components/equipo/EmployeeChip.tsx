'use client'

import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

// Colores de avatar por hash del nombre
function hashColor(name: string): string {
  const colors = [
    'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500',
    'bg-emerald-500', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500',
    'bg-pink-500', 'bg-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

const ROL_BADGE: Record<string, { label: string; className: string }> = {
  dueno:        { label: 'Dueño',        className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  admin:        { label: 'Admin',        className: 'bg-purple-100 text-purple-800 border-purple-200' },
  administrador:{ label: 'Admin',        className: 'bg-purple-100 text-purple-800 border-purple-200' },
  vendedor:     { label: 'Vendedor',     className: 'bg-blue-100   text-blue-800   border-blue-200'   },
  repartidor:   { label: 'Repartidor',   className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  caja:         { label: 'Caja',         className: 'bg-amber-100  text-amber-800  border-amber-200'  },
  almacen:      { label: 'Almacén',      className: 'bg-zinc-100   text-zinc-700   border-zinc-200'   },
}

export interface EmpleadoChipProps {
  id: string
  nombre: string
  rol: string
  activo: boolean
  email?: string | null
  /** Si está siendo arrastrado actualmente */
  isDragging?: boolean
}

export default function EmployeeChip({
  id,
  nombre,
  rol,
  activo,
  email,
  isDragging = false,
}: EmpleadoChipProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const badge = ROL_BADGE[rol.toLowerCase()] ?? { label: rol, className: 'bg-zinc-100 text-zinc-700 border-zinc-200' }
  const avatarColor = hashColor(nombre)
  const inits = initials(nombre)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border bg-white cursor-grab active:cursor-grabbing',
        'transition-all duration-150 select-none touch-none',
        isDragging
          ? 'shadow-2xl scale-105 border-indigo-300 ring-2 ring-indigo-200 z-50 opacity-95'
          : 'border-zinc-200 hover:border-zinc-300 hover:shadow-md shadow-sm',
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm',
        avatarColor,
        !activo && 'opacity-50 grayscale',
      )}>
        {inits}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold text-zinc-900 truncate', !activo && 'text-zinc-400')}>
          {nombre}
        </p>
        {email && (
          <p className="text-xs text-zinc-400 truncate">{email}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', badge.className)}>
          {badge.label}
        </span>
        {!activo && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
            Inactivo
          </span>
        )}
      </div>
    </div>
  )
}
