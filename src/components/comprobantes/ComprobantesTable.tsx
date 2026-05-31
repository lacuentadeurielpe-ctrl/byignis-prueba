'use client'

import { useState, useMemo } from 'react'
import { formatPEN, formatFechaHoraLima, cn } from '@/lib/utils'
import { Search, FileText, Download, CheckCircle2, AlertTriangle, RefreshCcw, ExternalLink, Receipt } from 'lucide-react'
import ModalNotaCredito from './ModalNotaCredito'
import type { Comprobante as ComprobanteDB } from '@/types/database'
import { toast } from 'sonner'

interface ComprobanteExt extends ComprobanteDB {
  pedidos?: any
}

export default function ComprobantesTable({ 
  comprobantes, 
  nubefactConfigurado 
}: { 
  comprobantes: ComprobanteExt[]
  nubefactConfigurado: boolean 
}) {
  const [busqueda, setBusqueda] = useState('')
  const [ncTarget, setNcTarget] = useState<ComprobanteExt | null>(null)

  const filtrados = useMemo(() => {
    return comprobantes.filter(c => {
      if (!busqueda) return true
      const b = busqueda.toLowerCase()
      return (
        c.numero_completo?.toLowerCase().includes(b) ||
        c.cliente_nombre?.toLowerCase().includes(b) ||
        c.cliente_ruc_dni?.includes(b) ||
        c.pedidos?.numero_pedido?.toLowerCase().includes(b)
      )
    })
  }, [comprobantes, busqueda])

  const labelEstado = (estado: string) => {
    switch (estado) {
      case 'emitido': return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold"><CheckCircle2 className="w-3 h-3" /> Aceptado</span>
      case 'error': return <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold"><AlertTriangle className="w-3 h-3" /> Error</span>
      case 'anulado': return <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">Anulado</span>
      default: return <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">Pendiente</span>
    }
  }

  const labelTipo = (tipo: string) => {
    switch (tipo) {
      case 'boleta': return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-100">Boleta</span>
      case 'factura': return <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-bold border border-purple-100">Factura</span>
      case 'nota_credito': return <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs font-bold border border-orange-100">N. Crédito</span>
      case 'nota_venta': return <span className="bg-zinc-50 text-zinc-700 px-2 py-0.5 rounded text-xs font-bold border border-zinc-200">Nota Venta</span>
      default: return tipo
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-50/50">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar comprobante, cliente o N° Pedido..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 whitespace-nowrap">Comprobante</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Monto</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtrados.map((comp) => (
              <tr key={comp.id} className="hover:bg-zinc-50/50 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                      {comp.tipo === 'nota_credito' ? <RefreshCcw className="w-4 h-4 text-orange-500" /> : <Receipt className="w-4 h-4 text-zinc-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900">{comp.numero_completo || 'Pendiente'}</span>
                        {labelTipo(comp.tipo || '')}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {formatFechaHoraLima(comp.created_at)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-zinc-900 line-clamp-1">{comp.cliente_nombre || 'Cliente Varios'}</p>
                  <p className="text-xs text-zinc-500">{comp.cliente_ruc_dni ? `Doc: ${comp.cliente_ruc_dni}` : 'Sin Documento'}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-bold tabular-nums text-zinc-900">{formatPEN(comp.total || 0)}</span>
                  {comp.pedidos?.numero_pedido && (
                    <div className="text-xs text-zinc-400 mt-0.5">Pedido #{comp.pedidos.numero_pedido}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {labelEstado(comp.estado)}
                  {comp.error_envio && (
                    <p className="text-[10px] text-red-500 max-w-[150px] truncate mt-1" title={comp.error_envio}>
                      {comp.error_envio}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    {comp.pdf_url && (
                      <a
                        href={comp.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                        title="Ver PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    )}
                    {comp.xml_url && (
                      <a
                        href={comp.xml_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                        title="Ver XML"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    
                    {comp.estado === 'emitido' && (comp.tipo === 'boleta' || comp.tipo === 'factura') && (
                      <button
                        onClick={() => setNcTarget(comp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 ml-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Nota de Crédito
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Receipt className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                  <p className="text-zinc-500 font-medium">No se encontraron comprobantes</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {ncTarget && ncTarget.pedidos && (
        <ModalNotaCredito
          pedido={ncTarget.pedidos}
          comprobanteOriginal={{ id: ncTarget.id, numeroCompleto: ncTarget.numero_completo || '', tipo: ncTarget.tipo || '' }}
          onCerrar={() => setNcTarget(null)}
          onEmitida={(res) => {
            setNcTarget(null)
            toast.success(`Nota de crédito ${res.numeroCompleto} emitida`)
            setTimeout(() => window.location.reload(), 1500)
          }}
        />
      )}
    </div>
  )
}
