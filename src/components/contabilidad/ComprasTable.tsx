'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, XCircle, Clock, Eye, AlertCircle, Search, Sparkles, FileSpreadsheet, Download, Paperclip } from 'lucide-react'
import { formatPEN } from '@/lib/utils'
import SmartPurchaseCapture from './SmartPurchaseCapture'
import * as XLSX from 'xlsx'
import { generarPLE81Compras } from '@/lib/export/sunat-ple'

interface Compra {
  id: string
  numero_compra: string
  tipo: 'formal' | 'informal' | 'mixta'
  proveedor_nombre: string | null
  numero_factura: string | null
  fecha_factura: string | null
  total_neto: number
  estado: 'borrador' | 'recibida' | 'anulada'
  created_at: string
  archivos_adjuntos: string[]
}

interface Props {
  comprasIniciales: Compra[]
  ferreteriaId: string
}

export default function ComprasTable({ comprasIniciales }: Props) {
  const [compras, setCompras] = useState<Compra[]>(comprasIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const filtered = compras.filter((c) => {
    const query = busqueda.toLowerCase().trim()
    const matchBusqueda =
      !query ||
      c.numero_compra.toLowerCase().includes(query) ||
      (c.proveedor_nombre && c.proveedor_nombre.toLowerCase().includes(query)) ||
      (c.numero_factura && c.numero_factura.toLowerCase().includes(query))
    
    const matchTipo = filtroTipo === 'todos' || c.tipo === filtroTipo
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado

    return matchBusqueda && matchTipo && matchEstado
  })

  const exportarExcel = () => {
    const data = filtered.map(c => ({
      'Código': c.numero_compra,
      'Tipo': c.tipo === 'formal' ? 'Formal' : c.tipo === 'informal' ? 'Informal' : 'Mixta',
      'Fecha Factura': c.fecha_factura ? new Date(c.fecha_factura).toLocaleDateString('es-PE') : '',
      'N° Factura': c.numero_factura || '',
      'Proveedor': c.proveedor_nombre || 'Sin proveedor',
      'Total (S/)': Number(c.total_neto).toFixed(2),
      'Estado': c.estado === 'recibida' ? 'Recibida' : c.estado === 'anulada' ? 'Anulada' : 'Borrador'
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Registro de Compras')
    XLSX.writeFile(wb, 'Registro_Compras.xlsx')
  }

  const exportarPLE = () => {
    const d = new Date()
    const periodo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    const txt = generarPLE81Compras(filtered, periodo)
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `LE20555555555${periodo}00080100001111.txt` // Formato genérico PLE
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function cambiarEstado(id: string, accion: 'confirmar' | 'anular' | 'eliminar') {
    if (accion === 'anular' && !confirm('¿Estás seguro de que deseas anular esta compra? Esto revertirá los cambios en el stock.')) {
      return
    }
    if (accion === 'eliminar' && !confirm('¿Estás seguro de eliminar este borrador de forma permanente?')) {
      return
    }

    setLoadingAction(id)
    try {
      if (accion === 'eliminar') {
        const res = await fetch(`/api/compras/${id}`, { method: 'DELETE' })
        if (res.ok) {
          setCompras((prev) => prev.filter((c) => c.id !== id))
        } else {
          const err = await res.json()
          alert(err.error || 'Error al eliminar el borrador.')
        }
      } else {
        const res = await fetch(`/api/compras/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion }),
        })
        if (res.ok) {
          const updated = await res.json()
          setCompras((prev) =>
            prev.map((c) => (c.id === id ? { ...c, estado: updated.estado } : c))
          )
        } else {
          const err = await res.json()
          alert(err.error || 'Error al cambiar el estado de la compra.')
        }
      }
    } catch {
      alert('Error de red al actualizar la compra.')
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por N° compra, factura o proveedor..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 transition"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-3 py-2 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
        >
          <option value="todos">Todos los tipos</option>
          <option value="formal">Formales (Con Factura)</option>
          <option value="informal">Informales (Sin Factura)</option>
          <option value="mixta">Mixtas</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-3 py-2 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
        >
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="recibida">Recibidas</option>
          <option value="anulada">Anuladas</option>
        </select>

        <button
          onClick={exportarExcel}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
        </button>
        <button
          onClick={exportarPLE}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
        >
          <Download className="w-4 h-4" /> Exportar PLE (SUNAT)
        </button>
        <Link
          href="/dashboard/catalog/scanner"
          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-semibold rounded-xl transition"
        >
          Ir al Escáner
        </Link>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100">
          <p className="text-sm font-medium text-zinc-500">No se encontraron compras</p>
          <p className="text-xs text-zinc-400 mt-1">Intenta ajustando los filtros o registra una nueva compra.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3.5">Código</th>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Fecha factura</th>
                  <th className="px-4 py-3.5">N° Factura</th>
                  <th className="px-4 py-3.5">Proveedor</th>
                  <th className="px-4 py-3.5 text-right">Total</th>
                  <th className="px-4 py-3.5 text-center">Estado</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((c) => {
                  const isBorrador = c.estado === 'borrador'
                  const isRecibida = c.estado === 'recibida'
                  const isAnulada = c.estado === 'anulada'

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/50 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-800">{c.numero_compra}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.tipo === 'formal'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : c.tipo === 'informal'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-purple-50 text-purple-700 border border-purple-100'
                        }`}>
                          {c.tipo === 'formal' ? 'Formal' : c.tipo === 'informal' ? 'Informal' : 'Mixta'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {c.fecha_factura ? new Date(c.fecha_factura).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-600">{c.numero_factura || '—'}</td>
                      <td className="px-4 py-3 text-zinc-700 max-w-[200px] truncate" title={c.proveedor_nombre || ''}>
                        {c.proveedor_nombre || <span className="text-zinc-400 italic">Sin proveedor</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-900 tabular-nums">
                        {formatPEN(c.total_neto)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isRecibida
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : isAnulada
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}>
                          {isRecibida ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" /> Recibida
                            </>
                          ) : isAnulada ? (
                            <>
                              <XCircle className="w-3.5 h-3.5" /> Anulada
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" /> Borrador
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {c.archivos_adjuntos && c.archivos_adjuntos.length > 0 && (
                            <button
                              onClick={() => window.open(c.archivos_adjuntos[0], '_blank')}
                              className="px-2.5 py-1 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg border border-zinc-200 transition flex items-center gap-1"
                              title="Ver documento adjunto"
                            >
                              <Paperclip className="w-3 h-3" /> Evidencia
                            </button>
                          )}
                          {isBorrador && (
                            <>
                              <button
                                disabled={loadingAction === c.id}
                                onClick={() => cambiarEstado(c.id, 'eliminar')}
                                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-red-50 text-red-600 rounded-lg border border-red-200 transition disabled:opacity-50"
                              >
                                Eliminar
                              </button>
                              <button
                                disabled={loadingAction === c.id}
                                onClick={() => cambiarEstado(c.id, 'confirmar')}
                                className="px-2.5 py-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                              >
                                Recibir
                              </button>
                            </>
                          )}
                          {isRecibida && (
                            <button
                              disabled={loadingAction === c.id}
                              onClick={() => cambiarEstado(c.id, 'anular')}
                              className="px-2.5 py-1 text-xs font-semibold bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-600 rounded-lg border border-zinc-200 hover:border-red-200 transition disabled:opacity-50"
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
