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

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">{error}</div>}

      <div className="flex justify-between items-center">
        <h3 className="font-medium text-zinc-900">Repartidores ({repartidores.length})</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="text"
            placeholder="Teléfono"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {repartidores.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay repartidores aún</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Teléfono</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">PIN</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {repartidores.map(rep => (
                <tr key={rep.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{rep.nombre}</td>
                  <td className="px-4 py-3 text-zinc-600">{rep.telefono}</td>
                  <td className="px-4 py-3 text-sm font-mono bg-zinc-100 px-2 py-1 rounded">{rep.pin}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(rep.id)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded"
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
