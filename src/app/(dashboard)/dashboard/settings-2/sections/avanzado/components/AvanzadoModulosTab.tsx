'use client'

import { useState, useEffect } from 'react'

const MODULOS = [
  { id: 'crm', label: 'CRM', desc: 'Gestión de clientes' },
  { id: 'delivery', label: 'Delivery', desc: 'Sistema de entregas' },
  { id: 'creditos', label: 'Créditos', desc: 'Línea de crédito' },
  { id: 'pos', label: 'POS', desc: 'Punto de venta' },
  { id: 'analytics', label: 'Analytics', desc: 'Reportes' },
]

export default function AvanzadoModulosTab() {
  const [modulos, setModulos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Módulos Disponibles</h3>
        <p className="text-xs text-zinc-500 mt-1">Activa o desactiva los módulos que necesitas para tu negocio</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {MODULOS.map(mod => (
          <label
            key={mod.id}
            className="flex items-start gap-4 p-5 border border-zinc-200 rounded-xl cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition group"
          >
            <input
              type="checkbox"
              checked={modulos.includes(mod.id)}
              onChange={() => toggleModulo(mod.id)}
              className="mt-1 w-5 h-5 border-zinc-300 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
            />
            <div className="flex-1">
              <p className="font-semibold text-sm text-zinc-900 group-hover:text-indigo-700 transition">{mod.label}</p>
              <p className="text-xs text-zinc-600 mt-1">{mod.desc}</p>
            </div>
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${modulos.includes(mod.id) ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
              {modulos.includes(mod.id) ? '✓' : '○'}
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg transition"
      >
        {isSaving ? '⏳ Guardando cambios...' : '✓ Guardar cambios'}
      </button>
    </div>
  )
}
