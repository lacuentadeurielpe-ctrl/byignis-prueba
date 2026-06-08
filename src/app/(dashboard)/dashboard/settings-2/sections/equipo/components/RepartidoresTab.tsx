'use client'

import { useState, useEffect } from 'react'
import { Truck, Plus, Trash2 } from 'lucide-react'

interface Repartidor {
  id: string
  nombre: string
  telefono: string
  pin: string
  estado: string
}

export default function RepartidoresTab() {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRepartidores()
  }, [])

  const fetchRepartidores = async () => {
    try {
      const res = await fetch('/api/settings-2/equipo/repartidores')
      if (res.ok) {
        const data = await res.json()
        setRepartidores(data)
      }
    } catch (err) {
      setError('Error al cargar repartidores')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!nombre || !telefono) {
      setError('Nombre y teléfono son requeridos')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings-2/equipo/repartidores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono }),
      })

      if (res.ok) {
        const newRepartidor = await res.json()
        setRepartidores([newRepartidor, ...repartidores])
        setNombre('')
        setTelefono('')
        setShowForm(false)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al agregar')
      }
    } catch (err) {
      setError('Error en la conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar repartidor?')) return

    try {
      const res = await fetch(`/api/settings-2/equipo/repartidores?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setRepartidores(repartidores.filter(r => r.id !== id))
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
          <h3 className="font-semibold text-zinc-900">Repartidores</h3>
          <p className="text-xs text-zinc-500 mt-1">{repartidores.length} repartidor{repartidores.length !== 1 ? 'es' : ''} en servicio</p>
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
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Teléfono (51987654321)"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
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

      {repartidores.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <Truck className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay repartidores aún</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega tu primer repartidor para comenzar</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Nombre</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Teléfono</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">PIN</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {repartidores.map(rep => (
                <tr key={rep.id} className="hover:bg-zinc-50 transition">
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{rep.nombre}</td>
                  <td className="px-5 py-3.5 text-zinc-600 font-mono text-xs">{rep.telefono}</td>
                  <td className="px-5 py-3.5">
                    <code className="px-2.5 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg">{rep.pin}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(rep.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar repartidor"
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
