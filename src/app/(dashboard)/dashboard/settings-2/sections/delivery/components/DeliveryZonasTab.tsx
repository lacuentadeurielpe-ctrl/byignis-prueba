'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, MapPin } from 'lucide-react'

interface Zona {
  id: string
  nombre: string
  radio_km: number
  eta_minutos: number
  costo_delivery: number
}

export default function DeliveryZonasTab() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [radioKm, setRadioKm] = useState('5')
  const [etaMinutos, setEtaMinutos] = useState('30')
  const [costoDelivery, setCostoDelivery] = useState('0')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/delivery/zonas')
        if (res.ok) {
          setZonas(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleAdd = async () => {
    if (!nombre) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/settings-2/delivery/zonas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          radio_km: parseFloat(radioKm),
          eta_minutos: parseInt(etaMinutos),
          costo_delivery: parseFloat(costoDelivery),
        }),
      })

      if (res.ok) {
        const newZona = await res.json()
        setZonas([...zonas, newZona])
        setNombre('')
        setRadioKm('5')
        setEtaMinutos('30')
        setCostoDelivery('0')
        setShowForm(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar zona?')) return
    try {
      const res = await fetch(`/api/settings-2/delivery/zonas?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setZonas(zonas.filter(z => z.id !== id))
      }
    } catch (err) {}
  }

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-zinc-900">Zonas ({zonas.length})</h3>
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
            placeholder="Nombre zona"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="Radio (km)"
            value={radioKm}
            onChange={e => setRadioKm(e.target.value)}
            step="0.5"
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="ETA (minutos)"
            value={etaMinutos}
            onChange={e => setEtaMinutos(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="Costo delivery"
            value={costoDelivery}
            onChange={e => setCostoDelivery(e.target.value)}
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

      {zonas.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay zonas configuradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Zona</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Radio</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">ETA</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Costo</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {zonas.map(zona => (
                <tr key={zona.id} className="border-b hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{zona.nombre}</td>
                  <td className="px-4 py-3">{zona.radio_km} km</td>
                  <td className="px-4 py-3">{zona.eta_minutos} min</td>
                  <td className="px-4 py-3">S/ {zona.costo_delivery}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(zona.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
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
