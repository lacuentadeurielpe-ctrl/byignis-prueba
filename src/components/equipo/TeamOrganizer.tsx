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
  closestCenter,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { Building2, Users, Loader2, Check } from 'lucide-react'
import EmployeeChip from './EmployeeChip'
import { cn } from '@/lib/utils'

// Roles que pueden estar en múltiples sucursales
const ROLES_MULTI_SUCURSAL = ['repartidor', 'admin', 'administrador', 'dueno']

export interface Empleado {
  id: string
  nombre: string
  rol: string
  activo: boolean
  email?: string | null
  local_id?: string | null
  /** IDs de sucursales si tiene multi-asignación */
  sucursales?: string[]
}

export interface Local {
  id: string
  nombre: string
  es_principal: boolean
}

interface DroppableColumnProps {
  id: string
  title: string
  isPrincipal?: boolean
  isPool?: boolean
  empleados: Empleado[]
  activeId: string | null
}

function DroppableColumn({ id, title, isPrincipal, isPool, empleados, activeId }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-2xl border-2 transition-all duration-200 min-h-[160px]',
        isPool
          ? 'border-dashed border-zinc-300 bg-zinc-50/50'
          : isOver
            ? 'border-indigo-400 bg-indigo-50/50 shadow-lg shadow-indigo-100'
            : 'border-zinc-200 bg-white shadow-sm',
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-3 border-b',
        isPool ? 'border-zinc-200' : 'border-zinc-100',
      )}>
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center',
          isPool ? 'bg-zinc-200' : 'bg-indigo-100',
        )}>
          {isPool
            ? <Users className="w-3.5 h-3.5 text-zinc-600" />
            : <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          }
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          {isPrincipal && (
            <p className="text-[10px] text-zinc-400 font-medium">Sucursal principal</p>
          )}
        </div>
        <span className={cn(
          'text-xs font-bold px-2 py-0.5 rounded-full',
          isPool ? 'bg-zinc-200 text-zinc-600' : 'bg-indigo-100 text-indigo-700',
        )}>
          {empleados.length}
        </span>
      </div>

      {/* Chips */}
      <div className="flex flex-col gap-2 p-3">
        {empleados.map(emp => (
          <EmployeeChip
            key={emp.id}
            id={emp.id}
            nombre={emp.nombre}
            rol={emp.rol}
            activo={emp.activo}
            email={emp.email}
            isDragging={activeId === emp.id}
          />
        ))}

        {/* Drop hint */}
        {isOver && (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-500 text-xs font-medium animate-pulse">
            <Check className="w-3.5 h-3.5" />
            Soltar aquí
          </div>
        )}

        {empleados.length === 0 && !isOver && (
          <div className="flex items-center justify-center py-6 text-xs text-zinc-400">
            {isPool ? 'Todos asignados ✓' : 'Arrastra empleados aquí'}
          </div>
        )}
      </div>
    </div>
  )
}

interface TeamOrganizerProps {
  empleados: Empleado[]
  locales: Local[]
}

export default function TeamOrganizer({ empleados: initial, locales }: TeamOrganizerProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const getColumnEmpleados = useCallback((localId: string | null) => {
    return empleados.filter(e => {
      if (localId === null) return !e.local_id
      return e.local_id === localId
    })
  }, [empleados])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const empId = active.id as string
    const targetLocalId = over.id === 'pool' ? null : over.id as string

    const emp = empleados.find(e => e.id === empId)
    if (!emp) return

    // Sin cambio
    if (emp.local_id === targetLocalId) return

    // Empleados no-multi solo pueden estar en una sucursal
    const isMultiRol = ROLES_MULTI_SUCURSAL.includes(emp.rol.toLowerCase())
    if (!isMultiRol && targetLocalId !== null) {
      // Verificar si ya tiene asignación distinta y avisarlo
    }

    // Optimistic update
    setEmpleados(prev => prev.map(e =>
      e.id === empId ? { ...e, local_id: targetLocalId } : e
    ))

    // Guardar en backend
    setSaving(empId)
    try {
      const res = await fetch('/api/settings-2/equipo/empleados', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empId, local_id: targetLocalId }),
      })
      if (!res.ok) {
        // Rollback
        setEmpleados(prev => prev.map(e => e.id === empId ? emp : e))
        alert('Error al guardar. Intenta de nuevo.')
      } else {
        setSavedId(empId)
        setTimeout(() => setSavedId(null), 2000)
      }
    } catch {
      setEmpleados(prev => prev.map(e => e.id === empId ? emp : e))
      alert('Error de conexión.')
    } finally {
      setSaving(null)
    }
  }

  const activeEmp = empleados.find(e => e.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Indicador de guardado */}
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

        {/* Pool de sin asignar */}
        <DroppableColumn
          id="pool"
          title="Sin sucursal asignada"
          isPool
          empleados={getColumnEmpleados(null)}
          activeId={activeId}
        />

        {/* Columnas por sucursal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {locales.map(local => (
            <DroppableColumn
              key={local.id}
              id={local.id}
              title={local.nombre}
              isPrincipal={local.es_principal}
              empleados={getColumnEmpleados(local.id)}
              activeId={activeId}
            />
          ))}
        </div>
      </div>

      {/* Drag overlay (el chip flotante mientras arrastras) */}
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeEmp && (
          <div className="rotate-2 opacity-95 scale-105">
            <EmployeeChip
              id={activeEmp.id}
              nombre={activeEmp.nombre}
              rol={activeEmp.rol}
              activo={activeEmp.activo}
              email={activeEmp.email}
              isDragging
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
