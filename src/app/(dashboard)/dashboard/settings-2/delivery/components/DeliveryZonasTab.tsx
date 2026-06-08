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

  if (loading) return <div className="text-sm text-zinc-500 py-8 text-center">Cargando...</div>

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-zinc-900">Zonas de Entrega</h3>
          <p className="text-xs text-zinc-500 mt-1">{zonas.length} zona{zonas.length !== 1 ? 's' : ''} configurada{zonas.length !== 1 ? 's' : ''}</p>
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
            placeholder="Nombre zona (ej: Centro, Sureste)"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="Radio (km)"
              value={radioKm}
              onChange={e => setRadioKm(e.target.value)}
              step="0.5"
              className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="ETA (minutos)"
              value={etaMinutos}
              onChange={e => setEtaMinutos(e.target.value)}
              className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <input
            type="number"
            placeholder="Costo delivery (S/)"
            value={costoDelivery}
            onChange={e => setCostoDelivery(e.target.value)}
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

      {zonas.length === 0 ? (
        <div className="p-12 text-center border border-zinc-200 rounded-xl bg-zinc-50">
          <MapPin className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600 font-medium">No hay zonas configuradas</p>
          <p className="text-xs text-zinc-500 mt-1">Agrega tu primera zona de entrega</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Zona</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Radio</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">ETA</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Costo</th>
                <th className="px-5 py-3.5 text-left font-semibold text-zinc-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {zonas.map(zona => (
                <tr key={zona.id} className="hover:bg-zinc-50 transition">
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{zona.nombre}</td>
                  <td className="px-5 py-3.5 text-zinc-600">{zona.radio_km} km</td>
                  <td className="px-5 py-3.5 text-zinc-600 font-mono">{zona.eta_minutos} min</td>
                  <td className="px-5 py-3.5 font-bold text-emerald-600">S/ {zona.costo_delivery.toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleDelete(zona.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar zona"
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
