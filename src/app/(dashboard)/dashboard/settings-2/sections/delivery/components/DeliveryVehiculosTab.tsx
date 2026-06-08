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

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-zinc-900">Vehículos ({vehiculos.length})</h3>
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
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
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

      {vehiculos.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay vehículos configurados</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Placa</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Asignado a</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.map(veh => (
                <tr key={veh.id} className="border-b hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium capitalize">{veh.tipo}</td>
                  <td className="px-4 py-3 font-mono">{veh.placa}</td>
                  <td className="px-4 py-3 text-zinc-600">{veh.repartidor_id ? 'Asignado' : 'Sin asignar'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(veh.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
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
