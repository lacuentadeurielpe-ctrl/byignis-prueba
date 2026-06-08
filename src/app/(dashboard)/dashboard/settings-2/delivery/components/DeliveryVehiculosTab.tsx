'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Truck } from 'lucide-react'

interface Vehiculo {
  id: string
  tipo: string
  placa: string
  repartidor_id: string | null
}

export default function DeliveryVehiculosTab() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState('moto')
  const [placa, setPlaca] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/delivery/vehiculos')
        if (res.ok) {
          setVehiculos(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleAdd = async () => {
    if (!placa) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/settings-2/delivery/vehiculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, placa }),
      })

      if (res.ok) {
        const newVeh = await res.json()
        setVehiculos([...vehiculos, newVeh])
        setTipo('moto')
        setPlaca('')
        setShowForm(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar vehículo?')) return
    try {
      const res = await fetch(`/api/settings-2/delivery/vehiculos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setVehiculos(vehiculos.filter(v => v.id !== id))
      }
    } catch (err) {}
  }

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-zinc-900">Vehículos</h3>
          <p className="text-xs text-zinc-500 mt-1">{vehiculos.length} vehículo{vehiculos.length !== 1 ? 's' : ''} registrado{vehiculos.length !== 1 ? 's' : ''}</p>
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
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="moto">Motocicleta</option>
            <option value="auto">Auto</option>
            <option value="camioneta">Camioneta</option>
            <option value="bicicleta">Bicicleta</option>
          </select>
          <input
            type="text"
            placeholder="Placa (ej: ABC-123)"
            value={placa}
            onChange={e => setPlaca(e.target.value.toUpperCase())}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase font-mono"
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

      {vehiculos.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <Truck className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay vehículos configurados</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega tu primer vehículo para comenzar</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Tipo</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Placa</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Asignado a</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {vehiculos.map(veh => (
                <tr key={veh.id} className="hover:bg-zinc-50 transition">
                  <td className="px-5 py-3.5 font-semibold capitalize text-zinc-900">{veh.tipo}</td>
                  <td className="px-5 py-3.5 font-mono font-bold text-indigo-600">{veh.placa}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg ${veh.repartidor_id ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {veh.repartidor_id ? '✓ Asignado' : '○ Sin asignar'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(veh.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar vehículo"
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
