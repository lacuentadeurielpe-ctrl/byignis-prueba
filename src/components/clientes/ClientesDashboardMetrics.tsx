import { Users, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatPEN } from '@/lib/utils'

interface MetricsProps {
  totalClientes: number
  clientesActivos30Dias: number
  deudaTotal: number
  topComprador: { nombre: string; total: number } | null
}

export default function ClientesDashboardMetrics({
  totalClientes,
  clientesActivos30Dias,
  deudaTotal,
  topComprador,
}: MetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Total clientes</p>
          <p className="text-2xl font-bold text-zinc-900">{totalClientes}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Activos (30d)</p>
          <p className="text-2xl font-bold text-zinc-900">{clientesActivos30Dias}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Deuda en la calle</p>
          <p className="text-2xl font-bold text-zinc-900">{formatPEN(deudaTotal)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm flex flex-col justify-center">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Top Comprador</p>
        {topComprador ? (
          <>
            <p className="text-sm font-bold text-zinc-900 truncate">{topComprador.nombre}</p>
            <p className="text-xs text-zinc-500">{formatPEN(topComprador.total)} en compras</p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Sin datos</p>
        )}
      </div>
    </div>
  )
}
