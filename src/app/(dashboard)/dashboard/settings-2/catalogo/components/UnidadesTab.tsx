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
          <h3 className="font-semibold text-zinc-900">Unidades de Medida</h3>
          <p className="text-xs text-zinc-500 mt-1">{unidades.length} unidad{unidades.length !== 1 ? 'es' : ''} configurada{unidades.length !== 1 ? 's' : ''}</p>
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
            type="text"
            placeholder="Nombre (ej: Metro, Kilo, Pieza)"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="Conversión a base"
            value={conversion}
            onChange={e => setConversion(e.target.value)}
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

      {unidades.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <Ruler className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay unidades configuradas</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega una nueva unidad para comenzar</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Nombre</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Conversión</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {unidades.map(unidad => (
                <tr key={unidad.id} className="hover:bg-zinc-50 transition">
                  <td className="px-5 py-3.5 font-medium text-zinc-900">{unidad.nombre}</td>
                  <td className="px-5 py-3.5 text-zinc-600 font-mono">{unidad.conversion_base}x</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(unidad.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar unidad"
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
