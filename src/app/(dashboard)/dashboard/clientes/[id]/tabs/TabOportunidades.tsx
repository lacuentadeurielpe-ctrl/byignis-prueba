'use client'

import { useState, useEffect, useCallback } from 'react'
import { Target, Plus, Trash2, ChevronDown, Loader2, TrendingUp } from 'lucide-react'
import { formatPEN, formatFecha } from '@/lib/utils'
import ModalCreateOportunidad from '@/components/clientes/ModalCreateOportunidad'

interface Oportunidad {
  id: string
  titulo: string
  descripcion: string | null
  estado: 'lead' | 'negociacion' | 'ganado' | 'perdido'
  valor_estimado: number
  probabilidad_cierre: number
  fecha_cierre_estimada: string | null
  created_at: string
}

interface Props {
  clienteId: string
  oportunidadesIniciales: Oportunidad[]
  esDueno: boolean
}

const ESTADO_CONFIG = {
  lead: { label: 'Lead', color: 'bg-blue-100 text-blue-700' },
  negociacion: { label: 'Negociación', color: 'bg-amber-100 text-amber-700' },
  ganado: { label: 'Ganado', color: 'bg-emerald-100 text-emerald-700' },
  perdido: { label: 'Perdido', color: 'bg-rose-100 text-rose-700' },
}

export default function TabOportunidades({ clienteId, oportunidadesIniciales, esDueno }: Props) {
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>(oportunidadesIniciales)
  const [showModal, setShowModal] = useState(false)
  const [loadingEstado, setLoadingEstado] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/crm/oportunidades?clienteId=${clienteId}`)
    if (res.ok) {
      const json = await res.json()
      setOportunidades(json.data ?? [])
    }
  }, [clienteId])

  async function cambiarEstado(id: string, nuevoEstado: string) {
    setLoadingEstado(id)
    try {
      await fetch(`/api/crm/oportunidades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      setOportunidades(prev => prev.map(o => o.id === id ? { ...o, estado: nuevoEstado as Oportunidad['estado'] } : o))
    } finally {
      setLoadingEstado(null)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta oportunidad?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/crm/oportunidades/${id}`, { method: 'DELETE' })
      setOportunidades(prev => prev.filter(o => o.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const abiertas = oportunidades.filter(o => o.estado === 'lead' || o.estado === 'negociacion')
  const valorPipeline = abiertas.reduce((s, o) => s + (o.valor_estimado * o.probabilidad_cierre / 100), 0)

  return (
    <div className="space-y-4">
      {/* Header con métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'En Pipeline', value: abiertas.length.toString(), sub: formatPEN(valorPipeline) + ' ponderado' },
          { label: 'Ganadas', value: oportunidades.filter(o => o.estado === 'ganado').length.toString(), sub: '' },
          { label: 'Perdidas', value: oportunidades.filter(o => o.estado === 'perdido').length.toString(), sub: '' },
          { label: 'Total', value: oportunidades.length.toString(), sub: '' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
            <p className="text-xs text-zinc-500 font-medium">{m.label}</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{m.value}</p>
            {m.sub && <p className="text-xs text-zinc-400 mt-0.5">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" /> Oportunidades CRM
          </h3>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        </div>

        {oportunidades.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-500">No hay oportunidades registradas.</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-xs text-indigo-600 hover:underline font-medium"
            >
              Crear primera oportunidad
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500">Título</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500">Valor Est.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500">Prob.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Cierre Est.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {oportunidades.map(o => {
                  const cfg = ESTADO_CONFIG[o.estado] ?? ESTADO_CONFIG.lead
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50 transition">
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 leading-tight">{o.titulo}</p>
                        {o.descripcion && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{o.descripcion}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative group">
                          <button
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.color} transition`}
                            disabled={loadingEstado === o.id}
                          >
                            {loadingEstado === o.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <>{cfg.label} <ChevronDown className="w-3 h-3" /></>
                            }
                          </button>
                          <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:block bg-white border border-zinc-200 rounded-xl shadow-lg py-1 min-w-[130px]">
                            {Object.entries(ESTADO_CONFIG).map(([key, c]) => (
                              <button
                                key={key}
                                onClick={() => cambiarEstado(o.id, key)}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 transition font-medium ${key === o.estado ? 'opacity-50 pointer-events-none' : ''}`}
                              >
                                <span className={`inline-block px-2 py-0.5 rounded-full ${c.color} mr-1`}>{c.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {o.valor_estimado > 0 ? formatPEN(o.valor_estimado) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-medium text-zinc-600">{o.probabilidad_cierre}%</span>
                        <div className="w-12 h-1 bg-zinc-100 rounded-full mt-1 ml-auto">
                          <div className="h-1 bg-indigo-500 rounded-full" style={{ width: `${o.probabilidad_cierre}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {o.fecha_cierre_estimada ? formatFecha(o.fecha_cierre_estimada) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {esDueno && (
                          <button
                            onClick={() => eliminar(o.id)}
                            disabled={deletingId === o.id}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition rounded"
                          >
                            {deletingId === o.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalCreateOportunidad
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); refresh() }}
        clienteId={clienteId}
      />
    </div>
  )
}
