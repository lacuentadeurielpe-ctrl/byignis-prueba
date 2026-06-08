'use client'

import { useState } from 'react'
import { X, AlertTriangle, MapPin, Truck, Clock, Brain } from 'lucide-react'

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

interface Props {
  prediction: Prediction
  onClose: () => void
  onSaved: () => void
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function PredictionFeedbackModal({ prediction, onClose, onSaved }: Props) {
  const [inusual, setInusual] = useState(prediction.owner_feedback?.inusual === true)
  const [notas, setNotas] = useState((prediction.owner_feedback?.notas as string) ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/delivery/intelligence/training', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictionId: prediction.id,
          feedback: { inusual, notas: notas.trim() || null },
        }),
      })
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  const error = prediction.error_min
  const errorColor = error == null
    ? 'text-zinc-400'
    : Math.abs(error) <= 5
    ? 'text-emerald-600'
    : Math.abs(error) <= 15
    ? 'text-amber-600'
    : 'text-rose-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-zinc-900">Revisar Predicción</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          {/* Context grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-zinc-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                <MapPin className="w-3 h-3" /> Zona
              </div>
              <div className="text-sm font-medium text-zinc-700">
                {prediction.zonas_delivery?.nombre ?? 'Sin zona'}
              </div>
            </div>
            <div className="p-3 bg-zinc-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                <Truck className="w-3 h-3" /> Vehículo
              </div>
              <div className="text-sm font-medium text-zinc-700">
                {prediction.vehiculo_tipo ?? 'No registrado'}
              </div>
            </div>
            <div className="p-3 bg-zinc-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                <Clock className="w-3 h-3" /> Momento
              </div>
              <div className="text-sm font-medium text-zinc-700">
                {DIAS[prediction.dia_semana]} {prediction.hora_dia}:00
              </div>
            </div>
            <div className="p-3 bg-zinc-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                <MapPin className="w-3 h-3" /> Distancia
              </div>
              <div className="text-sm font-medium text-zinc-700">
                {prediction.distancia_km ? `${prediction.distancia_km} km` : '—'}
              </div>
            </div>
          </div>

          {/* ETA comparison */}
          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-lg">
            <div className="text-center flex-1">
              <div className="text-xs text-indigo-600 mb-1">Predicho</div>
              <div className="text-xl font-bold text-indigo-900">{prediction.eta_predicho_min} min</div>
            </div>
            <div className="text-indigo-300 text-2xl">→</div>
            <div className="text-center flex-1">
              <div className="text-xs text-indigo-600 mb-1">Real</div>
              <div className="text-xl font-bold text-indigo-900">
                {prediction.duracion_real_min != null ? `${prediction.duracion_real_min} min` : '—'}
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-xs text-indigo-600 mb-1">Error</div>
              <div className={`text-xl font-bold ${errorColor}`}>
                {error != null ? `${error > 0 ? '+' : ''}${error} min` : '—'}
              </div>
            </div>
          </div>

          {/* Feedback controls */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={inusual}
                onChange={e => setInusual(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-amber-600"
              />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Marcar como inusual
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Se excluirá del entrenamiento (ej: tráfico inusual, pedido atípico)
                </p>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Ej: Había un accidente en la vía, tráfico inusual por feriado..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
