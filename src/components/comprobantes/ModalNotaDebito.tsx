'use client'

import { useState } from 'react'
import { Loader2, X, AlertTriangle } from 'lucide-react'
import { CATALOGO_10_NOTA_DEBITO, buscarMotivo } from '@/lib/facturacion/catalogos-sunat'

export default function ModalNotaDebito({
  comprobanteOriginal,
  onCerrar,
  onEmitida
}: {
  comprobanteOriginal: { id: string, numeroCompleto: string, tipo: string }
  onCerrar: () => void
  onEmitida: (resultado: { numeroCompleto: string; pdfUrl?: string }) => void
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motivoCodigo, setMotivoCodigo] = useState('01')
  const [motivoDescripcion, setMotivoDescripcion] = useState(buscarMotivo(CATALOGO_10_NOTA_DEBITO, '01')!.descripcion)
  const [montoAjuste, setMontoAjuste] = useState('')

  function handleMotivoChange(codigo: string) {
    const m = buscarMotivo(CATALOGO_10_NOTA_DEBITO, codigo)!
    setMotivoCodigo(codigo)
    setMotivoDescripcion(m.descripcion)
    setError(null)
  }

  const motivo = buscarMotivo(CATALOGO_10_NOTA_DEBITO, motivoCodigo)!
  const puedeEmitir = motivoDescripcion.trim().length > 0 && Number(montoAjuste) > 0

  async function emitir() {
    if (!puedeEmitir) {
      setError('Ingresa el monto del cargo adicional.')
      return
    }

    setCargando(true)
    setError(null)

    try {
      const res = await fetch('/api/comprobantes/nota-debito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comprobanteReferenciaId: comprobanteOriginal.id,
          motivoCodigo,
          motivoDescripcion,
          montoAjuste: Number(montoAjuste),
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error desconocido al emitir ND')
      }

      onEmitida({ numeroCompleto: data.numeroCompleto, pdfUrl: data.pdfUrl })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">Emitir Nota de Débito</h2>
          <button onClick={onCerrar} className="text-zinc-400 hover:text-zinc-600 transition" disabled={cargando}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm space-y-2">
            <p className="flex justify-between">
              <span className="text-zinc-500">Documento original:</span>
              <span className="font-semibold text-zinc-900">{comprobanteOriginal.numeroCompleto} ({comprobanteOriginal.tipo})</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Motivo SUNAT</label>
            <select
              value={motivoCodigo}
              onChange={(e) => handleMotivoChange(e.target.value)}
              disabled={cargando}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-900"
            >
              {CATALOGO_10_NOTA_DEBITO.map(m => (
                <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.etiqueta}</option>
              ))}
            </select>
            {motivo.hint && <p className="mt-1.5 text-xs text-zinc-500">{motivo.hint}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Monto del cargo (S/)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={montoAjuste}
              onChange={e => setMontoAjuste(e.target.value)}
              disabled={cargando}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-900"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Descripción detallada</label>
            <input
              type="text"
              value={motivoDescripcion}
              onChange={e => setMotivoDescripcion(e.target.value)}
              disabled={cargando}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-900"
              placeholder="Escribe el motivo..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50">
          <button
            onClick={onCerrar}
            disabled={cargando}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={emitir}
            disabled={cargando || !puedeEmitir}
            className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition shadow-sm"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Emitir Nota de Débito
          </button>
        </div>
      </div>
    </div>
  )
}
