'use client'

import { formatPEN, formatFecha, labelEstadoPedido, colorEstadoPedido } from '@/lib/utils'
import { ShoppingCart, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Props {
  pedidos: any[]
  cotizaciones: any[]
  creditos: any[]
  cliente: any
  esDueno: boolean
}

export default function TabOverview({ pedidos, cotizaciones, creditos, cliente, esDueno }: Props) {
  const pedidosRecientes = pedidos.slice(0, 5)
  const cotizacionesRecientes = cotizaciones.slice(0, 5)

  const deudaTotal = creditos.reduce((s, c) => s + (c.monto_total - c.monto_pagado), 0)
  const creditosVencidos = creditos.filter(c => c.estado === 'vencido' || (c.estado === 'activo' && new Date(c.fecha_limite) < new Date()))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna Izquierda: Insights */}
      <div className="lg:col-span-1 space-y-6">
        {/* Alertas */}
        {(deudaTotal > 0 || creditosVencidos.length > 0) && (
          <div className="bg-rose-50 rounded-2xl border border-rose-100 p-5">
            <h3 className="text-sm font-bold text-rose-800 flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4" /> Alertas de Cuenta
            </h3>
            <ul className="space-y-2 text-sm text-rose-700">
              {deudaTotal > 0 && <li>• Cliente tiene una deuda de <strong>{formatPEN(deudaTotal)}</strong></li>}
              {creditosVencidos.length > 0 && <li>• Tiene <strong>{creditosVencidos.length} crédito(s) vencido(s)</strong></li>}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Resumen de Actividad</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Total Pedidos</p>
              <p className="text-xl font-bold text-zinc-900">{pedidos.length}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Total Cotizaciones</p>
              <p className="text-xl font-bold text-zinc-900">{cotizaciones.length}</p>
            </div>
            {pedidos.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Última Compra</p>
                <p className="text-sm font-medium text-zinc-900">{formatFecha(pedidos[0].created_at)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500 mb-1">Registrado el</p>
              <p className="text-sm font-medium text-zinc-900">{formatFecha(cliente.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Timeline Reciente */}
      <div className="lg:col-span-2 space-y-6">
        {/* Pedidos Recientes */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-500" /> Pedidos Recientes
            </h3>
          </div>
          {pedidosRecientes.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400 text-center">No hay pedidos registrados</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {pedidosRecientes.map(p => (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition">
                  <div>
                    <p className="text-xs font-mono text-zinc-500">{p.numero_pedido}</p>
                    <p className="text-xs text-zinc-400 mt-1">{formatFecha(p.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1 ${colorEstadoPedido(p.estado)}`}>
                      {labelEstadoPedido(p.estado)}
                    </span>
                    {esDueno && <p className="text-sm font-bold text-zinc-900">{formatPEN(p.total)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cotizaciones Recientes */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-500" /> Cotizaciones Recientes
            </h3>
          </div>
          {cotizacionesRecientes.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400 text-center">No hay cotizaciones registradas</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {cotizacionesRecientes.map(c => (
                <div key={c.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition">
                  <div>
                    <p className="text-xs font-mono text-zinc-500">{c.numero_cotizacion}</p>
                    <p className="text-xs text-zinc-400 mt-1">{formatFecha(c.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1 ${
                      c.estado === 'aprobada' ? 'bg-green-100 text-green-700' :
                      c.estado === 'rechazada' ? 'bg-rose-100 text-rose-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {c.estado === 'aprobada' ? 'Aprobada' : c.estado === 'rechazada' ? 'Rechazada' : 'Pendiente'}
                    </span>
                    {esDueno && c.total > 0 && <p className="text-sm font-bold text-zinc-900">{formatPEN(c.total)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
