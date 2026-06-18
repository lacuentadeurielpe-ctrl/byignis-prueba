'use client'

import { Pedido } from './OrdersPremiumView'
import { cn, formatPEN, formatFechaHoraLima, colorEstadoPedido, labelEstadoPedido } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Package, Clock, CreditCard } from 'lucide-react'
import VentanaEntregaBadge from '@/components/delivery/VentanaEntregaBadge'

// Utilidades locales de filtros
const RANGOS_FECHA = [
  { label: 'Todos', value: '' },
  { label: 'Hoy', value: 'hoy' },
  { label: 'Esta semana', value: 'semana' },
  { label: 'Este mes', value: 'mes' },
]

export default function OrdersInboxList({
  pedidos,
  selectedOrderId,
  onSelectOrder,
  filters
}: {
  pedidos: Pedido[]
  selectedOrderId: string | null
  onSelectOrder: (id: string) => void
  filters: any
}) {

  return (
    <div className="flex flex-col h-full">
      {/* Inbox Tabs (Estado / Fecha) */}
      <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => filters.setFiltroEstado('')}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all", !filters.filtroEstado ? "bg-zinc-900 text-white shadow-sm" : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100")}
          >
            Todos ({filters.pedidos.length})
          </button>
          {Object.entries(filters.conteosEstados).map(([est, count]) => {
            const isActive = filters.filtroEstado === est
            return (
              <button
                key={est}
                onClick={() => filters.setFiltroEstado(isActive ? '' : est)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border",
                  isActive ? "bg-zinc-900 text-white border-zinc-900 shadow-sm" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                )}
              >
                {labelEstadoPedido(est)} ({(count as number)})
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 mt-2">
          {RANGOS_FECHA.map(r => {
            const isActive = filters.filtroFecha === r.value
            return (
              <button
                key={r.value}
                onClick={() => filters.setFiltroFecha(isActive ? '' : r.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border",
                  isActive ? "bg-zinc-200 text-zinc-900 border-zinc-300" : "bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100"
                )}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
        {pedidos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-6 text-center">
            <Package className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-sm">No hay pedidos que coincidan con los filtros</p>
          </div>
        ) : (
          pedidos.map((pedido) => {
            const isSelected = selectedOrderId === pedido.id
            const nombre = pedido.clientes?.nombre ?? pedido.nombre_cliente
            const colorClass = colorEstadoPedido(pedido.estado) // Ej: "bg-amber-100 text-amber-700 border-amber-200"

            return (
              <motion.button
                layout
                key={pedido.id}
                onClick={() => onSelectOrder(pedido.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all duration-200 group relative",
                  isSelected 
                    ? "bg-zinc-50 border-zinc-300 shadow-sm" 
                    : "bg-white border-transparent hover:bg-zinc-50 hover:border-zinc-200"
                )}
              >
                {/* Active Indicator */}
                {isSelected && (
                  <motion.div layoutId="active-indicator" className="absolute left-0 top-3 bottom-3 w-1 bg-zinc-900 rounded-r-full" />
                )}

                <div className="flex justify-between items-start mb-1.5 ml-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">{pedido.numero_pedido}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-semibold tracking-wide border", colorClass)}>
                      {labelEstadoPedido(pedido.estado)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-zinc-900">{formatPEN(pedido.total)}</span>
                </div>

                <div className="ml-1">
                  <p className="text-sm font-medium text-zinc-700 truncate pr-4">{nombre || 'Sin nombre'}</p>

                  {pedido.modalidad === 'delivery' && (pedido.eta_timestamp || pedido.eta_minutos) && (
                    <div className="mt-1.5">
                      <VentanaEntregaBadge etaTimestamp={pedido.eta_timestamp} />
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 text-[11px] text-zinc-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {formatFechaHoraLima(pedido.created_at)}
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" />
                      {pedido.estado_pago === 'pagado' ? <span className="text-emerald-600">Pagado</span> : <span className="text-orange-500">Pendiente</span>}
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
