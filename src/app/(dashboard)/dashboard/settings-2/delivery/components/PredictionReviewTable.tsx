'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import PredictionFeedbackModal from './PredictionFeedbackModal'

interface Prediction {
  id: string
  eta_predicho_min: number
  duracion_real_min: number | null
  error_min: number | null
  eta_source: string
  confidence: number
  vehiculo_tipo: string | null
  distancia_km: number | null
  hora_dia: number
  dia_semana: number
  created_at: string
  owner_feedback: Record<string, unknown> | null
  zonas_delivery: { nombre: string } | null
}

interface PaginatedResponse {
  predictions: Prediction[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function ErrorBadge({ error }: { error: number | null }) {
  if (error == null) return <span className="text-xs text-zinc-400">Pendiente</span>
  const abs = Math.abs(error)
  if (abs <= 5) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3" /> ±{abs} min</span>
  if (abs <= 15) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> ±{abs} min</span>
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700"><AlertTriangle className="w-3 h-3" /> ±{abs} min</span>
}

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    google: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    zone_avg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    haversine: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  }
  const labels: Record<string, string> = {
    google: 'Google',
    zone_avg: 'Historial',
    haversine: 'Haversine',
  }
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${styles[source] ?? styles.haversine}`}>
      {labels[source] ?? source}
    </span>
  )
}

const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function PredictionReviewTable() {
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedPred, setSelectedPred] = useState<Prediction | null>(null)

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/delivery/intelligence/training?page=${p}&limit=15&completed=true`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPage(page) }, [page, fetchPage])

  const handleFeedbackSaved = () => {
    setSelectedPred(null)
    fetchPage(page)
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-zinc-100">
        <h4 className="text-sm font-medium text-zinc-700">Historial de Predicciones</h4>
        <p className="text-xs text-zinc-400 mt-1">
          Click en una fila para revisar y marcar como inusual si fue un caso atípico
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-zinc-400">Cargando...</div>
      ) : !data?.predictions.length ? (
        <div className="p-8 text-center text-sm text-zinc-400">
          Sin predicciones completadas aún
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-4 py-3 font-medium text-zinc-500 text-xs">Fecha</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-xs">Zona</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-xs">Fuente</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-xs text-right">Predicho</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-xs text-right">Real</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-xs text-center">Error</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-xs text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.predictions.map(pred => {
                  const isMarked = pred.owner_feedback?.inusual === true
                  return (
                    <tr
                      key={pred.id}
                      onClick={() => setSelectedPred(pred)}
                      className={`border-b border-zinc-50 cursor-pointer transition-colors hover:bg-zinc-50 ${isMarked ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                        {DIAS_SHORT[pred.dia_semana]} {pred.hora_dia}:00
                        <div className="text-[11px] text-zinc-400">
                          {new Date(pred.created_at).toLocaleDateString('es-PE')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {pred.zonas_delivery?.nombre ?? <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={pred.eta_source} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-700">
                        {pred.eta_predicho_min} min
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-700">
                        {pred.duracion_real_min != null ? `${pred.duracion_real_min} min` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ErrorBadge error={pred.error_min} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isMarked ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600">Inusual</span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">Normal</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
              <span className="text-xs text-zinc-500">
                Página {data.page} de {data.totalPages} ({data.total} total)
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="p-1.5 rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Feedback modal */}
      {selectedPred && (
        <PredictionFeedbackModal
          prediction={selectedPred}
          onClose={() => setSelectedPred(null)}
          onSaved={handleFeedbackSaved}
        />
      )}
    </div>
  )
}
