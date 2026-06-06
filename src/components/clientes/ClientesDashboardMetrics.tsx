'use client'

import { Users, TrendingUp, AlertTriangle, UserCheck } from 'lucide-react'
import { formatPEN } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface MetricsProps {
  totalClientes: number
  clientesActivos30Dias: number
  deudaTotal: number
  topComprador: { nombre: string; total: number } | null
  clientes: any[]
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export default function ClientesDashboardMetrics({
  totalClientes,
  clientesActivos30Dias,
  deudaTotal,
  topComprador,
  clientes,
}: MetricsProps) {
  // Segmentación por Tipo
  const porTipo = [
    { name: 'Empresa', value: clientes.filter(c => c.tipo === 'empresa').length },
    { name: 'Persona', value: clientes.filter(c => c.tipo === 'persona').length },
    { name: 'Anónimo', value: clientes.filter(c => c.tipo === 'anonimo').length },
  ].filter(i => i.value > 0)

  // Top 5 Clientes por Volumen
  const top5 = [...clientes]
    .sort((a, b) => b.totalGastado - a.totalGastado)
    .slice(0, 5)
    .map(c => ({
      nombre: (c.nombre || c.alias || 'Anónimo').substring(0, 15),
      total: c.totalGastado
    }))

  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200/60 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Total clientes</p>
            <p className="text-2xl font-bold text-zinc-900">{totalClientes}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/60 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Activos (30d)</p>
            <p className="text-2xl font-bold text-zinc-900">{clientesActivos30Dias}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/60 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Deuda en calle</p>
            <p className="text-2xl font-bold text-zinc-900">{formatPEN(deudaTotal)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/60 p-5 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-16 h-16" />
          </div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1 relative z-10">Top Comprador</p>
          {topComprador ? (
            <div className="relative z-10">
              <p className="text-sm font-bold text-zinc-900 truncate">{topComprador.nombre}</p>
              <p className="text-xs font-medium text-indigo-600 mt-0.5">{formatPEN(topComprador.total)}</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin datos</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 lg:col-span-1">
          <h3 className="text-sm font-bold text-zinc-900 mb-6">Segmentación de Cartera</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={porTipo}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {porTipo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#18181b', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {porTipo.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs font-medium text-zinc-600">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 lg:col-span-2">
          <h3 className="text-sm font-bold text-zinc-900 mb-6">Top 5 Clientes por Volumen</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis 
                  dataKey="nombre" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#71717a' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  tickFormatter={(value) => `S/${value}`}
                />
                <Tooltip
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatPEN(value), 'Volumen']}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
