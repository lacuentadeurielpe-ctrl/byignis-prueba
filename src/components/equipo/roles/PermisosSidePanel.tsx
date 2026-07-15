'use client'

import { useState, useEffect } from 'react'
import { X, Shield, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react'
import {
  GRUPOS_PERMISOS,
  PLANTILLAS,
  ETIQUETAS_PLANTILLA,
  DESCRIPCIONES_PLANTILLA,
  detectarPlantilla,
  normalizarPermisos,
  type PermisoMap,
  type Permiso,
  type PlantillaPermiso,
} from '@/lib/auth/permisos'
import { cn } from '@/lib/utils'
import type { MiembroEquipo } from './RolesBoard'

interface PermisosSidePanelProps {
  miembro: MiembroEquipo | null
  onClose: () => void
  onSaved: (miembroId: string, permisos: PermisoMap) => void
}

const PLANTILLA_LABELS = Object.entries(ETIQUETAS_PLANTILLA) as [PlantillaPermiso, string][]

export default function PermisosSidePanel({ miembro, onClose, onSaved }: PermisosSidePanelProps) {
  const [permisos, setPermisos] = useState<PermisoMap>(() =>
    normalizarPermisos((miembro?.permisos ?? {}) as Record<string, unknown>),
  )
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync cuando cambia el miembro seleccionado
  useEffect(() => {
    if (miembro) {
      setPermisos(normalizarPermisos((miembro.permisos ?? {}) as Record<string, unknown>))
      setSaved(false)
      // Abrir el primer grupo por defecto
      const primer = GRUPOS_PERMISOS[0]?.label
      if (primer) setGruposAbiertos({ [primer]: true })
    }
  }, [miembro?.id])

  if (!miembro) return null

  const plantillaActual = detectarPlantilla(permisos)

  const aplicarPlantilla = (nombre: PlantillaPermiso) => {
    setPermisos(normalizarPermisos(PLANTILLAS[nombre] as Record<string, unknown>))
    setSaved(false)
  }

  const togglePermiso = (key: Permiso) => {
    setPermisos(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const toggleGrupo = (label: string) => {
    setGruposAbiertos(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/equipo/miembros/${miembro.id}/permisos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permisos }),
      })
      if (res.ok) {
        setSaved(true)
        onSaved(miembro.id, permisos)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const err = await res.json()
        alert(err.error || 'Error al guardar permisos')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const totalActivos = Object.values(permisos).filter(Boolean).length
  const totalPermisos = Object.keys(permisos).length

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {miembro.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-tight">
                {miembro.nombre}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{miembro.rol}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plantillas */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Plantilla rápida
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PLANTILLA_LABELS.filter(([k]) => k !== 'personalizado').map(([key, label]) => (
              <button
                key={key}
                onClick={() => aplicarPlantilla(key)}
                title={DESCRIPCIONES_PLANTILLA[key]}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-lg border transition-all text-left',
                  plantillaActual === key
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200 dark:shadow-indigo-900'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {plantillaActual === 'personalizado' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Permisos personalizados
            </p>
          )}
        </div>

        {/* Contador */}
        <div className="px-5 py-2 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{totalActivos}</span>
            <span> / {totalPermisos} permisos activos</span>
          </p>
          <div className="h-1.5 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${totalPermisos > 0 ? Math.round((totalActivos / totalPermisos) * 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Checklist de permisos */}
        <div className="flex-1 overflow-y-auto">
          {GRUPOS_PERMISOS.map((grupo) => {
            const isOpen = gruposAbiertos[grupo.label] ?? false
            const activosEnGrupo = grupo.permisos.filter(p => permisos[p.key]).length

            return (
              <div key={grupo.label} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                {/* Header de grupo */}
                <button
                  onClick={() => toggleGrupo(grupo.label)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      {grupo.label}
                    </span>
                    <span className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded-full',
                      activosEnGrupo > 0
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
                    )}>
                      {activosEnGrupo}/{grupo.permisos.length}
                    </span>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-zinc-400" />
                    : <ChevronDown className="w-4 h-4 text-zinc-400" />
                  }
                </button>

                {/* Permisos del grupo */}
                {isOpen && (
                  <div className="px-5 pb-3 space-y-1.5 animate-in fade-in duration-150">
                    {grupo.permisos.map(({ key, label }) => {
                      const activo = permisos[key] ?? false
                      return (
                        <label
                          key={key}
                          className={cn(
                            'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all group',
                            activo
                              ? 'bg-indigo-50 dark:bg-indigo-900/20'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                          )}
                        >
                          {/* Checkbox custom */}
                          <div
                            onClick={() => togglePermiso(key)}
                            className={cn(
                              'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150',
                              activo
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-zinc-300 dark:border-zinc-600 group-hover:border-indigo-400',
                            )}
                          >
                            {activo && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                          <span
                            onClick={() => togglePermiso(key)}
                            className={cn(
                              'text-sm leading-snug select-none',
                              activo
                                ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                                : 'text-zinc-600 dark:text-zinc-400',
                            )}
                          >
                            {label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer — Guardar */}
        <div className="p-5 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all duration-200',
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900',
            )}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved && <Check className="w-4 h-4" />}
            {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </>
  )
}
