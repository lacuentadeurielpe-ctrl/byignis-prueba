'use client'

import { useState, useEffect } from 'react'

export default function AvanzadoPoliticasTab() {
  const [data, setData] = useState({
    permitir_venta_sin_stock: false,
    requiere_aprobacion_credito: false,
    margen_minimo_descuento: 5,
  })
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/avanzado/politicas')
        if (res.ok) {
          setData(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/settings-2/avanzado/politicas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4 max-w-2xl">
      <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50">
        <input
          type="checkbox"
          checked={data.permitir_venta_sin_stock}
          onChange={e => setData({ ...data, permitir_venta_sin_stock: e.target.checked })}
          className="w-4 h-4 border-zinc-300 rounded"
        />
        <div>
          <p className="font-medium text-sm text-zinc-900">Permitir venta sin stock</p>
          <p className="text-xs text-zinc-600">Vender aunque no haya stock</p>
        </div>
      </label>

      <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50">
        <input
          type="checkbox"
          checked={data.requiere_aprobacion_credito}
          onChange={e => setData({ ...data, requiere_aprobacion_credito: e.target.checked })}
          className="w-4 h-4 border-zinc-300 rounded"
        />
        <div>
          <p className="font-medium text-sm text-zinc-900">Requiere aprobación de crédito</p>
          <p className="text-xs text-zinc-600">Validar línea de crédito antes de vender</p>
        </div>
      </label>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Margen mínimo de descuento (%)</label>
        <input
          type="number"
          value={data.margen_minimo_descuento}
          onChange={e => setData({ ...data, margen_minimo_descuento: parseFloat(e.target.value) })}
          className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm max-w-xs"
        />
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
