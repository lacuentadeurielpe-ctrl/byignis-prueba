'use client'

import { useState } from 'react'
import { BarChart2, Tag, DollarSign, FileText } from 'lucide-react'
import TarifasProveedorTab from './TarifasProveedorTab'
import PreciosTenantTab    from './PreciosTenantTab'
import FacturasGastoTab    from './FacturasGastoTab'

interface PorModelo { llamadas: number; creditos: number; costoUsd: number }
interface TopTenant  { nombre: string; creditos: number }

interface Props {
  stats: {
    porModelo:     Record<string, PorModelo>
    porTarea:      Record<string, number>
    topTenants:    [string, TopTenant][]
    totalCreditos: number
    totalCostoUsd: number
    totalLlamadas: number
  }
}

const TABS = [
  { id: 'consumo',  label: 'Consumo',          Icon: BarChart2  },
  { id: 'tarifas',  label: 'Tarifas proveedor', Icon: Tag        },
  { id: 'precios',  label: 'Precios a tenants', Icon: DollarSign },
  { id: 'facturas', label: 'Facturas de gasto', Icon: FileText   },
]

export default function IAPanel({ stats }: Props) {
  const [tab, setTab] = useState<'consumo' | 'tarifas' | 'precios' | 'facturas'>('consumo')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">IA & Costos</h1>
        <p className="text-gray-400 text-sm mt-1">Gestión económica del uso de inteligencia artificial</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Pestaña Consumo ─────────────────────────────────────────────────── */}
      {tab === 'consumo' && (
        <div>
          {/* Totales */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">Total créditos (30d)</p>
              <p className="text-2xl font-bold text-indigo-400">{stats.totalCreditos.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">Costo total USD (30d)</p>
              <p className="text-2xl font-bold text-green-400">${stats.totalCostoUsd.toFixed(4)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">Llamadas a IA (30d)</p>
              <p className="text-2xl font-bold">{stats.totalLlamadas.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Por modelo */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Por modelo</h3>
              <div className="space-y-3">
                {Object.entries(stats.porModelo)
                  .sort((a, b) => b[1].costoUsd - a[1].costoUsd)
                  .map(([modelo, data]) => (
                    <div key={modelo}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-mono text-xs text-gray-300">{modelo}</span>
                        <span className="text-green-400 text-xs">${data.costoUsd.toFixed(4)} USD</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{data.llamadas} llamadas</span>
                        <span className="text-indigo-300">{data.creditos.toLocaleString()} cr</span>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full">
                        <div
                          className="h-1 bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min(100, (data.costoUsd / Math.max(stats.totalCostoUsd, 0.0001)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                {Object.keys(stats.porModelo).length === 0 && (
                  <p className="text-gray-500 text-sm">Sin datos</p>
                )}
              </div>
            </div>

            {/* Por tarea */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Por tipo de tarea</h3>
              <div className="space-y-2">
                {Object.entries(stats.porTarea)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tarea, creditos]) => (
                    <div key={tarea} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-gray-400 w-36 truncate">{tarea}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full">
                        <div
                          className="h-2 bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (creditos / Math.max(stats.totalCreditos, 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-blue-300 w-16 text-right">{creditos.toLocaleString()}</span>
                    </div>
                  ))}
                {Object.keys(stats.porTarea).length === 0 && (
                  <p className="text-gray-500 text-sm">Sin datos</p>
                )}
              </div>
            </div>
          </div>

          {/* Top consumidores */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-medium">Top consumidores (30d)</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium text-right">Créditos</th>
                  <th className="px-4 py-3 font-medium">% del total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {stats.topTenants.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">Sin datos</td>
                  </tr>
                )}
                {stats.topTenants.map(([fid, data], i) => (
                  <tr key={fid} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <a href={`/superadmin/tenants/${fid}`} className="text-white hover:text-indigo-400">
                        {data.nombre}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-300">
                      {data.creditos.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full max-w-24">
                          <div
                            className="h-1.5 bg-indigo-500 rounded-full"
                            style={{ width: `${Math.min(100, (data.creditos / Math.max(stats.totalCreditos, 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {((data.creditos / Math.max(stats.totalCreditos, 1)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insight de costo promedio por llamada */}
          {stats.totalLlamadas > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Métricas de eficiencia (30d)</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Costo prom. por llamada</p>
                  <p className="text-lg font-bold text-white">
                    ${(stats.totalCostoUsd / stats.totalLlamadas).toFixed(5)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Costo por crédito consumido</p>
                  <p className="text-lg font-bold text-white">
                    {stats.totalCreditos > 0
                      ? `$${(stats.totalCostoUsd / stats.totalCreditos).toFixed(5)}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Promedio créditos/llamada</p>
                  <p className="text-lg font-bold text-white">
                    {(stats.totalCreditos / stats.totalLlamadas).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Otras pestañas ──────────────────────────────────────────────────── */}
      {tab === 'tarifas'  && <TarifasProveedorTab />}
      {tab === 'precios'  && <PreciosTenantTab    />}
      {tab === 'facturas' && <FacturasGastoTab    />}
    </div>
  )
}
