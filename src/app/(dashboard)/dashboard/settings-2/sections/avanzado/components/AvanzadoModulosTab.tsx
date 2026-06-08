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

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">Selecciona qué módulos deseas activar</p>
      <div className="space-y-3">
        {MODULOS.map(mod => (
          <label key={mod.id} className="flex items-start gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50">
            <input
              type="checkbox"
              checked={modulos.includes(mod.id)}
              onChange={() => toggleModulo(mod.id)}
              className="mt-1 w-4 h-4 border-zinc-300 rounded"
            />
            <div>
              <p className="font-medium text-sm text-zinc-900">{mod.label}</p>
              <p className="text-xs text-zinc-600">{mod.desc}</p>
            </div>
          </label>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg disabled:opacity-50"
      >
        {isSaving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
