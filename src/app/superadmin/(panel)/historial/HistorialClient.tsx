'use client'

import { useState } from 'react'

interface RegistroHistorial {
  id: string
  nombre: string
  estado_actual: string
  fecha_registro: string
  fecha_inicio: string
  fecha_salida: string | null
}

interface Props {
  historial: RegistroHistorial[]
}

export default function HistorialClient({ historial }: Props) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = historial.filter(h => {
    if (busqueda && !h.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      <input
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-64"
      />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Registro</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Salida / Fin</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Tiempo Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtrados.map(h => {
              const regDate = new Date(h.fecha_registro).toLocaleDateString('es-PE')
              const outDate = h.fecha_salida ? new Date(h.fecha_salida).toLocaleDateString('es-PE') : '—'
              
              // Calculo de tiempo (aproximado)
              const inicio = new Date(h.fecha_inicio).getTime()
              const fin = h.fecha_salida ? new Date(h.fecha_salida).getTime() : Date.now()
              const dias = Math.max(0, Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)))
              
              const isVitalicio = h.estado_actual === 'activo'
              const colorCls = isVitalicio ? 'text-green-400 bg-green-900/20 border-green-700' : 'text-red-400 bg-red-900/20 border-red-700'

              return (
                <tr key={h.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{h.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-medium ${colorCls}`}>
                      {isVitalicio ? 'Activo / Vitalicio' : 'Inactivo / Restringido'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{regDate}</td>
                  <td className="px-4 py-3 text-gray-400">{outDate}</td>
                  <td className="px-4 py-3 text-gray-300">{dias} días</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
