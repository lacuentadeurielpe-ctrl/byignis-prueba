'use client'

import { formatPEN, formatFecha } from '@/lib/utils'
import { Wallet, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'

interface Credito {
  id: string
  monto_total: number
  monto_pagado: number
  fecha_limite: string
  estado: string
  created_at: string
  pedidos?: { numero_pedido: string }
  abonos_credito?: any[]
}

interface Props {
  creditos: Credito[]
  clienteId: string
}

export default function TabCuentaCorriente({ creditos, clienteId }: Props) {
  const deudaTotal = creditos.reduce((s, c) => s + (c.monto_total - c.monto_pagado), 0)
  
  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${deudaTotal > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Saldo Deudor Total</p>
            <p className={`text-2xl font-bold ${deudaTotal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatPEN(deudaTotal)}
            </p>
          </div>
        </div>
        {/* Futuro: Botón para abrir modal de registrar abono global */}
        {/* <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
          Registrar Abono
        </button> */}
      </div>

      {/* Lista de Créditos */}
      <div>
        <h3 className="text-sm font-bold text-zinc-900 mb-4">Detalle de Créditos</h3>
        {creditos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
            <p className="text-sm text-zinc-500">El cliente no tiene créditos registrados.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">Ref</th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-500 text-xs uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-500 text-xs uppercase tracking-wider">Pagado</th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-500 text-xs uppercase tracking-wider">Saldo</th>
                  <th className="px-4 py-3 text-center font-semibold text-zinc-500 text-xs uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {creditos.map(c => {
                  const saldo = c.monto_total - c.monto_pagado
                  const estaVencido = saldo > 0 && new Date(c.fecha_limite) < new Date()
                  
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 transition">
                      <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{formatFecha(c.created_at)}</td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{c.pedidos?.numero_pedido || 'N/A'}</td>
                      <td className="px-4 py-3 text-right text-zinc-900">{formatPEN(c.monto_total)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatPEN(c.monto_pagado)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${saldo > 0 ? 'text-rose-600' : 'text-zinc-400'}`}>
                        {formatPEN(saldo)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {saldo <= 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Pagado
                          </span>
                        ) : estaVencido ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-700">
                            <AlertCircle className="w-3 h-3" /> Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                            <Calendar className="w-3 h-3" /> Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
