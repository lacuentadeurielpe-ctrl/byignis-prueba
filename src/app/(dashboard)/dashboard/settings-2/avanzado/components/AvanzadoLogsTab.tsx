'use client'

import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'

interface Log {
  id: string
  evento: string
  detalle: string
  created_at: string
}

export default function AvanzadoLogsTab() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/settings-2/avanzado/logs')
        if (res.ok) {
          setLogs(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="text-sm text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-zinc-900">Log de Auditoría</h3>
        <button className="text-xs text-indigo-600 hover:text-indigo-700">Exportar</button>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay registros en el log</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Evento</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-700">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b hover:bg-zinc-50">
                  <td className="px-4 py-3 text-xs text-zinc-600">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{log.evento}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{log.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
