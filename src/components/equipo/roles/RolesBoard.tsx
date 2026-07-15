'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import WorkerPool from './WorkerPool'
import SucursalColumn from './SucursalColumn'
import PermisosSidePanel from './PermisosSidePanel'
import type { PermisoMap } from '@/lib/auth/permisos'

// [FIX #17] Sincronizado con /api/settings-2/equipo/empleados/asignar-sucursal/route.ts
// ROLES_MULTI_SUCURSAL: pueden estar en más de una sucursal simultáneamente
const ROLES_MULTI_SUCURSAL = ['repartidor', 'admin', 'administrador', 'dueno', 'gerente']

export interface MiembroEquipo {
  id: string
  nombre: string
  rol: string
  activo: boolean
  email?: string | null
  permisos: Partial<PermisoMap>
  /** IDs de las sucursales donde está asignado (vía empleado_sucursal) */
  sucursales: string[]
  /** Legacy local_id directo en miembros_ferreteria */
  local_id?: string | null
}

export interface LocalEquipo {
  id: string
  nombre: string
  es_principal: boolean
}

interface RolesBoardProps {
  miembros: MiembroEquipo[]
  locales: LocalEquipo[]
}

export default function RolesBoard({ miembros: initial, locales }: RolesBoardProps) {
  const [miembros, setMiembros] = useState<MiembroEquipo[]>(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  // [FIX #5/#6] Guardamos el miembro activo directamente desde data.current
  // para evitar el parseo frágil del string ID (que falla con tmp-* IDs)
  const [activeMiembroOverlay, setActiveMiembroOverlay] = useState<MiembroEquipo | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [panelMiembro, setPanelMiembro] = useState<MiembroEquipo | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  // Miembros visibles en el pool (los que no tienen ninguna sucursal)
  const poolMiembros = miembros.filter(m => {
    const suc = m.sucursales?.length ? m.sucursales : m.local_id ? [m.local_id] : []
    return suc.length === 0
  })

  // Miembros asignados a una sucursal concreta
  const getMiembrosDeSucursal = useCallback((localId: string) => {
    return miembros.filter(m => {
      const suc = m.sucursales?.length ? m.sucursales : m.local_id ? [m.local_id] : []
      return suc.includes(localId)
    })
  }, [miembros])

  // [FIX #5/#6] Drag start: guardamos miembro desde data.current, sin parsear strings
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    const miembroId = event.active.data.current?.miembroId as string | undefined
    if (miembroId) {
      const miembro = miembros.find(m => m.id === miembroId)
      setActiveMiembroOverlay(miembro ?? null)
    } else {
      setActiveMiembroOverlay(null)
    }
  }

  // [FIX #5/#6] Drag end: usamos data.current para extraer IDs sin parsear strings
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setActiveMiembroOverlay(null)
    if (!over) return

    // Leer desde data.current — mucho más robusto que parsear el string ID
    const miembroId = active.data.current?.miembroId as string | undefined
    const sourceLocalId = (active.data.current?.source as string | undefined) ?? null
    // source === 'pool' significa que viene del pool (sin sucursal asignada)
    const sourceNormalized = sourceLocalId === 'pool' ? null : sourceLocalId

    if (!miembroId) return

    // [FIX #7] Validar que el over.id es un destino válido (local real o 'pool')
    const validDropIds = new Set<string>(['pool', ...locales.map(l => l.id)])
    if (!validDropIds.has(over.id as string)) return

    const targetLocalId = over.id === 'pool' ? null : over.id as string

    const miembro = miembros.find(m => m.id === miembroId)
    if (!miembro) return

    // Sin cambio real
    if (sourceNormalized === targetLocalId) return

    const isMultiRol = ROLES_MULTI_SUCURSAL.includes(miembro.rol.toLowerCase())

    // Optimistic update
    const prevMiembros = miembros
    setMiembros(prev => prev.map(m => {
      if (m.id !== miembroId) return m

      let sucursales = [...(m.sucursales?.length ? m.sucursales : m.local_id ? [m.local_id] : [])]

      if (!isMultiRol) {
        // Trabajador normal: solo puede estar en una sucursal
        sucursales = targetLocalId ? [targetLocalId] : []
      } else {
        // Multi-rol: se puede mover entre sucursales manteniendo las otras
        if (sourceNormalized) sucursales = sucursales.filter(s => s !== sourceNormalized)
        if (targetLocalId && !sucursales.includes(targetLocalId)) sucursales.push(targetLocalId)
      }

      return { ...m, sucursales, local_id: sucursales[0] ?? null }
    }))

    // Persistir en backend
    setSaving(miembroId)
    try {
      const res = await fetch('/api/settings-2/equipo/empleados/asignar-sucursal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleadoId: miembroId,
          targetLocalId,
          sourceLocalId: sourceNormalized,
        }),
      })
      if (!res.ok) {
        setMiembros(prevMiembros) // rollback
        alert('Error al guardar. Intenta de nuevo.')
      } else {
        setSavedId(miembroId)
        setTimeout(() => setSavedId(null), 2000)
      }
    } catch {
      setMiembros(prevMiembros)
      alert('Error de conexión.')
    } finally {
      setSaving(null)
    }
  }

  // Cuando se guardan permisos desde el panel lateral
  const handlePermisosSaved = (miembroId: string, permisos: PermisoMap) => {
    setMiembros(prev => prev.map(m => m.id === miembroId ? { ...m, permisos } : m))
    // Sync el panel abierto
    setPanelMiembro(prev => prev?.id === miembroId ? { ...prev, permisos } : prev)
  }

  // [FIX #6] Miembro para el overlay — ya guardado en handleDragStart desde data.current
  const activeMiembro = activeMiembroOverlay

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          {/* Columna izquierda: pool */}
          <div className="lg:sticky lg:top-6">
            <WorkerPool
              miembros={poolMiembros}
              locales={locales}
              onOpenPermisos={setPanelMiembro}
              onMiembroAdded={(nuevo) => setMiembros(prev => [...prev, nuevo])}
            />
          </div>

          {/* Columna derecha: sucursales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {locales.map(local => (
              <SucursalColumn
                key={local.id}
                local={local}
                miembros={getMiembrosDeSucursal(local.id)}
                onOpenPermisos={setPanelMiembro}
                // [FIX #4] El local virtual 'principal' no existe en DB — deshabilitar DnD
                disabled={local.id === 'principal'}
              />
            ))}
          </div>
        </div>

        {/* Overlay visual del elemento arrastrado */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeMiembro && (
            <div className="rotate-1 opacity-90 scale-105 bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-500 rounded-xl px-3 py-2.5 shadow-xl flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {activeMiembro.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{activeMiembro.nombre}</p>
                <p className="text-xs text-zinc-400 capitalize">{activeMiembro.rol}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Toast de guardado */}
      {(saving || savedId) && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg transition-all',
          savedId ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-white',
        )}>
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
            : <><Check className="w-3.5 h-3.5" /> Guardado ✓</>
          }
        </div>
      )}

      {/* Panel lateral de permisos */}
      <PermisosSidePanel
        miembro={panelMiembro}
        onClose={() => setPanelMiembro(null)}
        onSaved={handlePermisosSaved}
      />
    </>
  )
}
