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

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-5">
        <label className="flex items-start gap-4 p-4 border border-amber-200 bg-amber-50 rounded-xl cursor-pointer hover:border-amber-300 transition group">
          <input
            type="checkbox"
            checked={data.permitir_venta_sin_stock}
            onChange={e => setData({ ...data, permitir_venta_sin_stock: e.target.checked })}
            className="mt-0.5 w-5 h-5 border-zinc-300 rounded accent-amber-600 cursor-pointer flex-shrink-0"
          />
          <div className="flex-1">
            <p className="font-semibold text-sm text-zinc-900 group-hover:text-amber-700 transition">Permitir venta sin stock</p>
            <p className="text-xs text-zinc-600 mt-1">Permite vender productos aunque no haya stock disponible</p>
          </div>
        </label>

        <label className="flex items-start gap-4 p-4 border border-rose-200 bg-rose-50 rounded-xl cursor-pointer hover:border-rose-300 transition group">
          <input
            type="checkbox"
            checked={data.requiere_aprobacion_credito}
            onChange={e => setData({ ...data, requiere_aprobacion_credito: e.target.checked })}
            className="mt-0.5 w-5 h-5 border-zinc-300 rounded accent-rose-600 cursor-pointer flex-shrink-0"
          />
          <div className="flex-1">
            <p className="font-semibold text-sm text-zinc-900 group-hover:text-rose-700 transition">Requiere aprobación de crédito</p>
            <p className="text-xs text-zinc-600 mt-1">Valida la línea de crédito disponible antes de autorizar ventas</p>
          </div>
        </label>

        <div className="pt-4 border-t border-zinc-100">
          <label className="block text-sm font-semibold text-zinc-900 mb-3">Margen mínimo de descuento</label>
          <p className="text-xs text-zinc-500 mb-3">Descuento mínimo que puede aplicarse a un producto</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={data.margen_minimo_descuento}
              onChange={e => setData({ ...data, margen_minimo_descuento: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-lg font-bold text-indigo-600 min-w-10 text-right">{data.margen_minimo_descuento}%</span>
          </div>
        </div>
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
