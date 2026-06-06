'use client'

import { formatPEN, formatFecha, labelEstadoPedido, colorEstadoPedido } from '@/lib/utils'
import { ShoppingCart, FileText } from 'lucide-react'

interface Props {
  pedidos: any[]
  cotizaciones: any[]
  esDueno: boolean
}

export default function TabHistorial({ pedidos, cotizaciones, esDueno }: Props) {
  // Productos más comprados (agregación de items_pedido)
  const productosMap: Record<string, { cantidad: number, total: number }> = {}
  
  pedidos.filter(p => p.estado !== 'cancelado').forEach(p => {
    (p.items_pedido || []).forEach((item: any) => {
      if (!productosMap[item.nombre_producto]) {
        productosMap[item.nombre_producto] = { cantidad: 0, total: 0 }
      }
      productosMap[item.nombre_producto].cantidad += item.cantidad
      productosMap[item.nombre_producto].total += (item.subtotal || 0)
    })
  })

  const topProductos = Object.entries(productosMap)
    .map(([nombre, datos]) => ({ nombre, ...datos }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10)

  return (
    <div className="space-y-8">
      {/* Top Productos */}
      {topProductos.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-zinc-900 mb-3">Productos más comprados (Top 10)</h3>
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-500 text-xs uppercase tracking-wider">Cantidad Acumulada</th>
                  {esDueno && <th className="px-4 py-3 text-right font-semibold text-zinc-500 text-xs uppercase tracking-wider">Valor Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {topProductos.map((p, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition">
                    <td className="px-4 py-3 text-zinc-900 font-medium">{p.nombre}</td>
                    <td className="px-4 py-3 text-right text-zinc-600">{p.cantidad}</td>
                    {esDueno && <td className="px-4 py-3 text-right text-zinc-600">{formatPEN(p.total)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Historial Pedidos */}
        <div>
          <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-indigo-500" /> Todos los Pedidos
          </h3>
          {pedidos.length === 0 ? (
             <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
               <p className="text-sm text-zinc-500">No hay pedidos registrados.</p>
             </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-zinc-50">
                {pedidos.map(p => (
                  <div key={p.id} className="p-4 hover:bg-zinc-50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-mono text-zinc-500">{p.numero_pedido}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{formatFecha(p.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1 ${colorEstadoPedido(p.estado)}`}>
                          {labelEstadoPedido(p.estado)}
                        </span>
                        {esDueno && <p className="text-sm font-bold text-zinc-900">{formatPEN(p.total)}</p>}
                      </div>
                    </div>
                    {/* Items preview */}
                    <div className="mt-2 text-xs text-zinc-500">
                      {(p.items_pedido || []).slice(0, 2).map((item: any, idx: number) => (
                        <p key={idx} className="truncate">{item.cantidad}x {item.nombre_producto}</p>
                      ))}
                      {(p.items_pedido || []).length > 2 && (
                        <p className="text-indigo-500 mt-0.5">+{p.items_pedido.length - 2} productos más</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Historial Cotizaciones */}
        <div>
          <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-500" /> Todas las Cotizaciones
          </h3>
          {cotizaciones.length === 0 ? (
             <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
               <p className="text-sm text-zinc-500">No hay cotizaciones registradas.</p>
             </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-zinc-50">
                {cotizaciones.map(c => (
                  <div key={c.id} className="p-4 hover:bg-zinc-50 transition flex justify-between items-center">
                    <div>
                      <p className="text-xs font-mono text-zinc-500">COT-{c.id.split('-')[0].toUpperCase()}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{formatFecha(c.created_at)}</p>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
