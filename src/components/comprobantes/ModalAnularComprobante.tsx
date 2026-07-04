'use client'

import { useState } from 'react'
import { Loader2, X, AlertTriangle } from 'lucide-react'

export default function ModalAnularComprobante({
  comprobante,
  onCerrar,
  onAnulada,
}: {
  comprobante: { id: string; numeroCompleto: string }
  onCerrar: () => void
  onAnulada: () => void
}) {
  const [motivo, setMotivo]     = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function confirmar() {
    if (!motivo.trim()) { setError('Debes ingresar un motivo'); return }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/comprobantes/${comprobante.id}/anular`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ motivo: motivo.trim() }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Error al solicitar la anulación'); return }
      onAnulada()
    } catch {
      setError('Error de red al solicitar la anulación')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-bold text-zinc-900">Anular {comprobante.numeroCompleto}</h3>
          <button onClick={onCerrar} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            La anulación se comunica a SUNAT automáticamente al día siguiente (regla SUNAT: no se
            puede anular el mismo día de emisión). No necesitas hacer nada más después de solicitarla.
          </span>
        </div>

        <label className="block text-xs font-semibold text-zinc-600 mb-1">Motivo de la anulación</label>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ej: Error en los datos del cliente, venta duplicada, devolución total..."
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
        />

        {error && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCerrar}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={cargando}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition"
          >
            {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
            Solicitar anulación
          </button>
        </div>
      </div>
    </div>
  )
}
