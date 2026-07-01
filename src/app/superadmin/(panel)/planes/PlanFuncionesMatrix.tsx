'use client'

import { useState, useEffect, useCallback } from 'react'

interface Funcion {
  id:          string
  clave:       string
  nombre:      string
  modulo:      string
  descripcion: string | null
  orden:       number
  habilitada:  boolean
}

const MODULO_LABELS: Record<string, string> = {
  bot:           'Bot WhatsApp',
  pos:           'Punto de Venta',
  inventario:    'Inventario',
  delivery:      'Delivery',
  crm:           'CRM',
  ia:            'IA Avanzada',
  reportes:      'Reportes',
  integraciones: 'Integraciones',
  sistema:       'Sistema',
}

export default function PlanFuncionesMatrix({ planId, planNombre }: { planId: string; planNombre: string }) {
  const [funciones, setFunciones] = useState<Funcion[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/superadmin/planes/${planId}/funciones`)
    if (res.ok) {
      const d = await res.json()
      setFunciones(d.funciones ?? [])
    } else {
      setError('Error cargando funciones')
    }
    setLoading(false)
  }, [planId])

  useEffect(() => { cargar() }, [cargar])

  async function toggle(funcion: Funcion) {
    setSaving(funcion.id)
    const res = await fetch(`/api/superadmin/planes/${planId}/funciones`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcion_id: funcion.id, habilitada: !funcion.habilitada }),
    })
    if (res.ok) {
      setFunciones(prev => prev.map(f =>
        f.id === funcion.id ? { ...f, habilitada: !f.habilitada } : f
      ))
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error actualizando')
    }
    setSaving(null)
  }

  if (loading) {
    return <p className="text-xs text-gray-500 py-4 text-center">Cargando funciones...</p>
  }

  if (error) {
    return <p className="text-xs text-red-400 py-2">{error}</p>
  }

  const grupos: Record<string, Funcion[]> = {}
  for (const f of funciones) {
    if (!grupos[f.modulo]) grupos[f.modulo] = []
    grupos[f.modulo].push(f)
  }

  const habilitadasCount = funciones.filter(f => f.habilitada).length

  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-400">
          Funciones de <span className="text-white">{planNombre}</span>
          <span className="ml-2 text-gray-600">({habilitadasCount}/{funciones.length} habilitadas)</span>
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(grupos).map(([modulo, fns]) => (
          <div key={modulo}>
            <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              {MODULO_LABELS[modulo] ?? modulo}
            </p>
            <div className="space-y-1">
              {fns.map(f => (
                <label
                  key={f.id}
                  className={`flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    f.habilitada ? 'bg-indigo-950/40 border border-indigo-800/40' : 'bg-gray-900/50 border border-gray-800'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={f.habilitada}
                      disabled={saving === f.id}
                      onChange={() => toggle(f)}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 accent-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${f.habilitada ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {f.nombre}
                      {saving === f.id && <span className="ml-1 text-gray-500">...</span>}
                    </p>
                    {f.descripcion && (
                      <p className="text-xs text-gray-600 mt-0.5">{f.descripcion}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
