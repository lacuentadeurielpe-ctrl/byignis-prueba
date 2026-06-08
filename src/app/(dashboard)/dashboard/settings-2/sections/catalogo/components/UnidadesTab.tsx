'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Ruler } from 'lucide-react'

interface Unidad {
  id: string
  nombre: string
  conversion_base: number
  es_default: boolean
}

export default function UnidadesTab() {
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [conversion, setConversion] = useState('1')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUnidades()
  }, [])

  const fetchUnidades = async () => {
    try {
      const res = await fetch('/api/settings-2/catalogo/unidades')
      if (res.ok) {
        setUnidades(await res.json())
      }
    } catch (err) {
      setError('Error al cargar unidades')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!nombre) {
      setError('Nombre es requerido')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/catalogo/unidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, conversion_base: parseFloat(conversion) }),
      })

      if (res.ok) {
        const newUnidad = await res.json()
        setUnidades([...unidades, newUnidad])
        setNombre('')
        setConversion('1')
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
    if (!confirm('¿Eliminar unidad?')) return

    try {
      const res = await fetch(`/api/settings-2/catalogo/unidades?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUnidades(unidades.filter(u => u.id !== id))
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
        <h3 className="font-medium text-zinc-900">Unidades de Medida ({unidades.length})</h3>
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
            type="text"
            placeholder="Nombre (ej: Metro, Kilo, Pieza)"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="Conversión a base"
            value={conversion}
            onChange={e => setConversion(e.target.value)}
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

      {unidades.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <Ruler className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay unidades configuradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Conversión</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map(unidad => (
                <tr key={unidad.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{unidad.nombre}</td>
                  <td className="px-4 py-3 text-zinc-600">{unidad.conversion_base}x</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(unidad.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
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
