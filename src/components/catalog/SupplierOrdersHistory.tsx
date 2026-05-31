'use client'

import { useState } from 'react'
import { FileText, Download, Trash2, Edit2, RefreshCw, CheckCircle, Clock, XCircle, Package } from 'lucide-react'
import { formatPEN, formatFechaHoraLima } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import type { OrdenCompra } from '@/types/database'
import useSWR from 'swr'
import { swrFetcher, fetcher } from '@/lib/api/client'
import { toast } from 'sonner'

interface SupplierOrdersHistoryProps {
  onEditOrder?: (orden: OrdenCompra) => void
}

export default function SupplierOrdersHistory({ onEditOrder }: SupplierOrdersHistoryProps) {
  const { data: ordenes, error, isLoading, mutate } = useSWR<OrdenCompra[]>('/api/ordenes-compra', swrFetcher)
  const [savingId, setSavingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    toast('¿Estás seguro de eliminar esta orden de compra?', {
      action: {
        label: 'Sí, eliminar',
        onClick: async () => {
          setSavingId(id)
          try {
            await fetcher(`/api/ordenes-compra/${id}`, { method: 'DELETE' })
            toast.success('Orden eliminada correctamente')
            mutate(ordenes?.filter(o => o.id !== id), false)
          } catch (e: any) {
            toast.error(e.message || 'Error al eliminar la orden')
          } finally {
            setSavingId(null)
          }
        }
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {}
      }
    })
  }

  const handleChangeEstado = async (id: string, nuevoEstado: string) => {
    setSavingId(id)
    try {
      const updated = await fetcher(`/api/ordenes-compra/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      toast.success('Estado actualizado correctamente')
      mutate(ordenes?.map(o => o.id === id ? { ...o, estado: updated.estado } : o), false)
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar el estado')
    } finally {
      setSavingId(null)
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'borrador': return <Badge variant="gray"><Clock className="w-3 h-3 mr-1"/> Borrador</Badge>
      case 'enviado': return <Badge variant="blue"><SendIcon className="w-3 h-3 mr-1"/> Enviado</Badge>
      case 'entregado': return <Badge variant="green"><CheckCircle className="w-3 h-3 mr-1"/> Entregado</Badge>
      case 'cancelado': return <Badge variant="red"><XCircle className="w-3 h-3 mr-1"/> Cancelado</Badge>
      default: return <Badge variant="gray">{estado}</Badge>
    }
  }

  if (isLoading) {
    return <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-violet-500" /></div>
  }

  if (error) {
    return <div className="py-12 text-center text-red-500 font-semibold bg-red-50 rounded-2xl border border-red-100 p-6">Error al cargar el historial: {error.message}</div>
  }

  if (!ordenes || ordenes.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500 bg-white rounded-2xl border border-zinc-100">
        <Package className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
        <p className="text-sm font-medium">No hay órdenes de compra guardadas</p>
        <p className="text-xs text-zinc-400 mt-1">Crea nuevas órdenes desde la pestaña "Crear Órdenes"</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50/50 border-b border-zinc-100 text-xs text-zinc-500 text-left uppercase tracking-wider font-semibold">
              <th className="px-5 py-4">N° Orden</th>
              <th className="px-5 py-4">Proveedor</th>
              <th className="px-5 py-4">Fecha</th>
              <th className="px-5 py-4">Total</th>
              <th className="px-5 py-4">Estado</th>
              <th className="px-5 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {ordenes.map(orden => (
              <tr key={orden.id} className="hover:bg-zinc-50/50 transition">
                <td className="px-5 py-4 font-bold text-zinc-900">{orden.numero_orden}</td>
                <td className="px-5 py-4 font-medium text-zinc-700">{orden.proveedor}</td>
                <td className="px-5 py-4 text-zinc-500 text-xs">{formatFechaHoraLima(orden.created_at)}</td>
                <td className="px-5 py-4 font-bold text-zinc-900">{formatPEN(orden.costo_total)}</td>
                <td className="px-5 py-4">
                  {savingId === orden.id ? (
                    <span className="text-xs text-zinc-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/> Actualizando...</span>
                  ) : (
                    <select
                      value={orden.estado}
                      onChange={(e) => handleChangeEstado(orden.id, e.target.value)}
                      className="text-xs font-semibold px-2 py-1 rounded-lg border border-zinc-200 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="borrador">Borrador</option>
                      <option value="enviado">Enviado</option>
                      <option value="entregado">Entregado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  )}
                </td>
                <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                  {onEditOrder && (
                    <button
                      onClick={() => onEditOrder(orden)}
                      disabled={savingId === orden.id}
                      className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      title="Editar orden"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  <a
                    href={`/api/ordenes-compra/${orden.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition"
                    title="Descargar PDF"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(orden.id)}
                    disabled={savingId === orden.id}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SendIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  )
}
