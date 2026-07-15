'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Users, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import WorkerCard from './WorkerCard'
import type { MiembroEquipo, LocalEquipo } from './RolesBoard'
import { useEmpleados } from '@/hooks/rrhh/useEmpleados'

interface WorkerPoolProps {
  miembros: MiembroEquipo[]
  locales: LocalEquipo[]
  onOpenPermisos: (miembro: MiembroEquipo) => void
  onMiembroAdded: (miembro: MiembroEquipo) => void
}

/** Columna izquierda: pool de trabajadores disponibles + formulario inline de creación */
export default function WorkerPool({ miembros, locales, onOpenPermisos, onMiembroAdded }: WorkerPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' })
  const { addEmpleado } = useEmpleados()

  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState('vendedor')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Mapa de localId → nombre para el badge de sucursal
  const localesMap = new Map(locales.map(l => [l.id, l.nombre]))

  const getSucursalNombre = (miembro: MiembroEquipo): string | null => {
    const suc = miembro.sucursales ?? (miembro.local_id ? [miembro.local_id] : [])
    if (suc.length === 0) return null
    if (suc.length === 1) return localesMap.get(suc[0]) ?? null
    return `${suc.length} sucursales`
  }

  const handleAdd = async () => {
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setFormError('Nombre, email y contraseña son requeridos')
      return
    }
    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)
    setFormError('')
    const res = await addEmpleado({ nombre: nombre.trim(), email: email.trim(), password, rol })
    if (res.success) {
      // res.data es EmpleadoRow tipado desde useEmpleados
      const d = res.data as { id?: string; nombre?: string; email?: string } | undefined
      onMiembroAdded({
        id: d?.id ?? `tmp-${Date.now()}`,
        nombre: d?.nombre ?? nombre.trim(),
        rol,
        activo: true,
        email: d?.email ?? email.trim(),
        permisos: {},
        sucursales: [],
        local_id: null,
      })
      setNombre('')
      setEmail('')
      setPassword('')
      setRol('vendedor')
      setShowForm(false)
    } else {
      setFormError(res.error || 'Error al agregar empleado')
    }
    setSaving(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-2xl border-2 transition-all duration-200',
        isOver
          ? 'border-zinc-400 bg-zinc-100/60 dark:bg-zinc-700/20'
          : 'border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Trabajadores</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Arrastra a una sucursal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full">
            {miembros.length}
          </span>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
        </div>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 space-y-3 animate-in slide-in-from-top-2 fade-in duration-150">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nuevo trabajador</p>
          {formError && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg">{formError}</p>
          )}
          <input
            type="text"
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
          />
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
          />
          <input
            type="password"
            placeholder="Contraseña temporal (mín. 6 chars)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
          />
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="vendedor">Vendedor (Mostrador)</option>
            <option value="repartidor">Repartidor</option>
            <option value="gerente">Gerente de Sucursal</option>
            <option value="admin">Administrador General</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl transition-all"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Guardando...' : 'Crear trabajador'}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError('') }}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de trabajadores */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        {miembros.map(miembro => (
          <WorkerCard
            key={miembro.id}
            miembro={miembro}
            sucursalNombre={getSucursalNombre(miembro)}
            onOpenPermisos={onOpenPermisos}
          />
        ))}

        {isOver && (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-700/20 text-zinc-500 text-xs font-medium">
            Devolver al pool
          </div>
        )}

        {miembros.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center py-8 text-xs text-zinc-400 dark:text-zinc-600">
            Todos asignados ✓
          </div>
        )}
      </div>
    </div>
  )
}
