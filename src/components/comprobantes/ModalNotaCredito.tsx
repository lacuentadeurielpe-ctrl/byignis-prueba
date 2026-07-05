'use client'

import { useState } from 'react'
import { Loader2, X, AlertTriangle, Minus, Plus } from 'lucide-react'
import { formatPEN } from '@/lib/utils'

export default function ModalNotaCredito({ 
  pedido, 
  comprobanteOriginal,
  onCerrar, 
  onEmitida 
}: {
  pedido: any // Using any to access items_pedido easily since it's a join
  comprobanteOriginal: { id: string, numeroCompleto: string, tipo: string }
  onCerrar: () => void
  onEmitida: (resultado: { numeroCompleto: string; pdfUrl?: string }) => void
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motivoCodigo, setMotivoCodigo] = useState('07') // 07 = Devolución por ítem
  const [motivoDescripcion, setMotivoDescripcion] = useState('Devolución por ítem defectuoso')

  // State to track how many items are being returned
  // Initialize with max quantities
  const [cantidadesDevueltas, setCantidadesDevueltas] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    pedido.items_pedido?.forEach((i: any) => {
      init[i.id] = i.cantidad
    })
    return init
  })

  const MOTIVOS = [
    { codigo: '07', desc: 'Devolución por ítem defectuoso' },
    { codigo: '01', desc: 'Anulación de la operación' },
    { codigo: '02', desc: 'Anulación por error en el RUC' },
    { codigo: '06', desc: 'Devolución total' }
  ]

  const totalDevolver = pedido.items_pedido?.reduce((sum: number, item: any) => {
    const cant = cantidadesDevueltas[item.id] || 0
    return sum + (cant * item.precio_unitario)
  }, 0) || 0

  const hasItemsToReturn = Object.values(cantidadesDevueltas).some(q => q > 0)

  async function emitir() {
    if (!motivoDescripcion.trim()) return setError('Debes ingresar una descripción.')
    if (!hasItemsToReturn) return setError('Debes seleccionar al menos un ítem para devolver.')
    
    setCargando(true)
    setError(null)
    
    try {
      const itemsDevueltos = pedido.items_pedido
        ?.filter((i: any) => (cantidadesDevueltas[i.id] || 0) > 0)
        .map((i: any) => ({
          producto_id: i.producto_id,
          cantidad: cantidadesDevueltas[i.id]
        }))

      const res = await fetch('/api/comprobantes/nota-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comprobanteReferenciaId: comprobanteOriginal.id,
          motivoCodigo,
          motivoDescripcion,
          itemsDevueltos,
        })
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.tokenInvalido) throw new Error('Credenciales SUNAT no configuradas o inválidas. Ve a Configuración → Integraciones → SUNAT Directo.')
        throw new Error(data.error || 'Error desconocido al emitir NC')
      }

      onEmitida({ numeroCompleto: data.numeroCompleto, pdfUrl: data.pdfUrl })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  function updateCantidad(itemId: string, maxCantidad: number, delta: number) {
    setCantidadesDevueltas(prev => {
      const current = prev[itemId] || 0
      const newCant = Math.max(0, Math.min(maxCantidad, current + delta))
      return { ...prev, [itemId]: newCant }
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">Emitir Nota de Crédito</h2>
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
            <label className="block text-sm font-medium text-zinc-700 mb-2">Productos a devolver</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {pedido.items_pedido?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 border border-zinc-200 rounded-xl">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-medium text-zinc-900 truncate">{item.nombre_producto}</p>
                    <p className="text-xs text-zinc-500">{formatPEN(item.precio_unitario)} / {item.unidad}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
                      <button 
                        onClick={() => updateCantidad(item.id, item.cantidad, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                        disabled={cantidadesDevueltas[item.id] === 0 || cargando}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums">
                        {cantidadesDevueltas[item.id] || 0}
                      </span>
                      <button 
                        onClick={() => updateCantidad(item.id, item.cantidad, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                        disabled={cantidadesDevueltas[item.id] === item.cantidad || cargando}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-between items-center py-3 border-t border-zinc-100">
              <span className="font-medium text-zinc-700">Total a devolver:</span>
              <span className="text-lg font-black text-red-600">{formatPEN(totalDevolver)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Motivo Sunat</label>
            <select
              value={motivoCodigo}
              onChange={(e) => {
                setMotivoCodigo(e.target.value)
                setMotivoDescripcion(e.target.options[e.target.selectedIndex].text)
              }}
              disabled={cargando}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-900"
            >
              {MOTIVOS.map(m => (
                <option key={m.codigo} value={m.codigo}>{m.desc}</option>
              ))}
            </select>
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
            disabled={cargando || !hasItemsToReturn}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition shadow-sm"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Procesar Devolución
          </button>
        </div>
      </div>
    </div>
  )
}
