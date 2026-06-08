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

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="flex justify-between items-center">
        <h3 className="font-medium text-zinc-900">Descuentos por Cantidad ({tiers.length})</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
          <input
            type="number"
            placeholder="Cantidad mínima"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="Descuento %"
            value={descuento}
            onChange={e => setDescuento(e.target.value)}
            step="0.01"
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {tiers.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <TrendingDown className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay descuentos configurados</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Cantidad Mínima</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Descuento</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map(tier => (
                <tr key={tier.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{tier.cantidad_minima} unidades</td>
                  <td className="px-4 py-3">{tier.descuento_porcentaje}%</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(tier.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
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
