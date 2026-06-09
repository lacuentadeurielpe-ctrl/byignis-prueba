'use client'

import { useState, useEffect, useMemo } from 'react'
import { Info, CheckCircle2, XCircle } from 'lucide-react'

const MODULOS = [
  { id: 'crm', label: 'CRM', desc: 'Gestión de clientes y oportunidades' },
  { id: 'delivery', label: 'Delivery', desc: 'Sistema de entregas y repartidores' },
  { id: 'creditos', label: 'Créditos', desc: 'Línea de crédito para clientes' },
  { id: 'pos', label: 'POS', desc: 'Punto de venta en caja' },
  { id: 'analytics', label: 'Analytics', desc: 'Reportes y estadísticas' },
]

export default function AvanzadoModulosTab() {
  const [modulos, setModulos]     = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [isSaving, setIsSaving]   = useState(false)

  // Módulos REALMENTE activos según la variable de entorno NEXT_PUBLIC_ACTIVE_MODULES
  // Esta variable controla el acceso real — los checkboxes de abajo son preferencias
  const modulosActivosEnv = useMemo<string[]>(() => {
    const raw = process.env.NEXT_PUBLIC_ACTIVE_MODULES ?? ''
    if (!raw) return MODULOS.map(m => m.id)   // Si no hay var → todos activos
    return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/avanzado/modulos')
        if (res.ok) {
          const data = await res.json()
          setModulos(data.modulos || [])
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggleModulo = (id: string) => {
    setModulos(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/settings-2/avanzado/modulos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulos }),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6">
      {/* Banner explicativo */}
      <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Estado real vs. preferencias guardadas</p>
          <p>
            Los módulos activos en producción están controlados por la variable de entorno
            <code className="mx-1 px-1 py-0.5 bg-blue-100 rounded font-mono">NEXT_PUBLIC_ACTIVE_MODULES</code>
            configurada en el servidor. Los checkboxes de abajo guardan las preferencias del plan,
            pero <strong>no activan ni desactivan módulos directamente</strong> — requieren
            actualizar la variable de entorno y redesplegar.
          </p>
        </div>
      </div>

      {/* Estado real desde la env var */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">Estado actual en producción</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {MODULOS.map(mod => {
            const activo = modulosActivosEnv.includes(mod.id)
            return (
              <div
                key={mod.id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${
                  activo
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-500'
                }`}
              >
                {activo
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-zinc-400 shrink-0" />}
                <span className="font-medium">{mod.label}</span>
                <span className="text-xs ml-auto">{activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Preferencias guardadas (no afectan la realidad sin redespliegue) */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Preferencias del plan</h3>
        <p className="text-xs text-zinc-500 mt-1 mb-3">
          Guarda los módulos que deseas tener activos. Estos datos se usan como referencia
          para el siguiente redespliegue o configuración.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          {MODULOS.map(mod => (
            <label
              key={mod.id}
              className="flex items-start gap-4 p-4 border border-zinc-200 rounded-xl cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition group"
            >
              <input
                type="checkbox"
                checked={modulos.includes(mod.id)}
                onChange={() => toggleModulo(mod.id)}
                className="mt-1 w-4 h-4 border-zinc-300 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
              />
              <div className="flex-1">
                <p className="font-semibold text-sm text-zinc-900 group-hover:text-indigo-700 transition">{mod.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{mod.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mt-4 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition"
        >
          {isSaving ? '⏳ Guardando...' : 'Guardar preferencias'}
        </button>
      </div>
    </div>
  )
}
