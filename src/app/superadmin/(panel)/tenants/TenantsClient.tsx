'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Tenant {
  id:                string
  nombre:            string
  telefono_whatsapp: string
  created_at:        string
  suscripcion:       string
  ventas:            number
  profit:            number
  espacio_mb:        number
}

interface Props {
  tenants: Tenant[]
}

export default function TenantsClient({ tenants }: Props) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filtrados = tenants.filter(t => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!t.nombre.toLowerCase().includes(q) && !t.telefono_whatsapp.includes(q)) return false
    }
    return true
  })

  async function cambiarSuscripcion(id: string, nuevoEstado: string) {
    if (!confirm(`¿Cambiar suscripción a ${nuevoEstado}?`)) return
    setLoadingId(id)
    const res = await fetch(`/api/superadmin/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suscripcion_estado: nuevoEstado })
    })
    setLoadingId(null)
    if (res.ok) {
      router.refresh()
    } else {
      alert('Error al actualizar la suscripción')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Clientes / Suscripciones</h1>
          <p className="text-gray-400 text-sm mt-1">{filtrados.length} clientes registrados</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Buscar por nombre o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-64"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Ventas Totales</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Profit</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Espacio BD</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Suscripción</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">
                  No hay clientes que coincidan
                </td>
              </tr>
            )}
            {filtrados.map(t => {
              // Determinamos el estado visual
              let estadoStr = 'Restringido'
              let colorCls = 'text-red-400 border-red-700 bg-red-900/20'
              
              if (t.suscripcion === 'activo') {
                estadoStr = 'Pro / Vitalicio'
                colorCls = 'text-green-400 border-green-700 bg-green-900/20'
              } else if (t.suscripcion === 'trial') {
                estadoStr = 'Trial'
                colorCls = 'text-yellow-400 border-yellow-700 bg-yellow-900/20'
              }

              return (
                <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white text-sm">{t.nombre}</div>
                    <div className="text-xs text-gray-500 font-mono">{t.telefono_whatsapp}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">S/ {t.ventas.toFixed(2)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">S/ {t.profit.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-400">{t.espacio_mb} MB</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-medium ${colorCls}`}>
                      {estadoStr}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={loadingId === t.id}
                      onChange={(e) => cambiarSuscripcion(t.id, e.target.value)}
                      value=""
                      className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="" disabled>Cambiar estado...</option>
                      <option value="vitalicio">Hacer Vitalicio</option>
                      <option value="pro">Plan Pro Normal</option>
                      <option value="restringido">Restringir / Suspender</option>
                    </select>
                    {loadingId === t.id && <span className="ml-2 text-xs text-gray-500">Guardando...</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
