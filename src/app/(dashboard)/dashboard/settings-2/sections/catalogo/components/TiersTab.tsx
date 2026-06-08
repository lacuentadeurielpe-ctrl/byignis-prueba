'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, TrendingDown } from 'lucide-react'

interface Tier {
  id: string
  cantidad_minima: number
  descuento_porcentaje: number
  precio_fijo: number | null
}

export default function TiersTab() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [cantidad, setCantidad] = useState('')
  const [descuento, setDescuento] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTiers()
  }, [])

  const fetchTiers = async () => {
    try {
      const res = await fetch('/api/settings-2/catalogo/tiers')
      if (res.ok) {
        setTiers(await res.json())
      }
    } catch (err) {
      setError('Error al cargar tiers')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!cantidad || !descuento) {
      setError('Cantidad y descuento son requeridos')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/catalogo/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad_minima: parseInt(cantidad), descuento_porcentaje: parseFloat(descuento) }),
      })

      if (res.ok) {
        const newTier = await res.json()
        setTiers([...tiers, newTier].sort((a, b) => a.cantidad_minima - b.cantidad_minima))
        setCantidad('')
        setDescuento('')
        setShowForm(false)
      } else {
        const err = await res.json()
        setError(err.error)
      }
    } catch (err) {
      setError('Error en la conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar tier?')) return

    try {
      const res = await fetch(`/api/settings-2/catalogo/tiers?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTiers(tiers.filter(t => t.id !== id))
      } else {
        setError('Error al eliminar')
      }
    } catch (err) {
      setError('Error en la conexión')
    }
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-start gap-3">
          <span className="flex-shrink-0 font-bold">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-zinc-900">Descuentos por Cantidad</h3>
          <p className="text-xs text-zinc-500 mt-1">{tiers.length} tier{tiers.length !== 1 ? 's' : ''} configurado{tiers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl space-y-4">
          <input
            type="number"
            placeholder="Cantidad mínima"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="Descuento %"
            value={descuento}
            onChange={e => setDescuento(e.target.value)}
            step="0.01"
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-lg transition"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-lg transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {tiers.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <TrendingDown className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay descuentos configurados</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega una nueva regla de descuento para comenzar</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Cantidad Mínima</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Descuento</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tiers.map(tier => (
                <tr key={tier.id} className="hover:bg-zinc-50 transition">
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{tier.cantidad_minima} unidades</td>
                  <td className="px-5 py-3.5 text-emerald-600 font-bold">{tier.descuento_porcentaje}% OFF</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(tier.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar descuento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
