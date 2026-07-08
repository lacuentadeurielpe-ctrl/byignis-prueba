'use client'

import { Users, Truck, DollarSign, Activity } from 'lucide-react'
import Link from 'next/link'

export default function EquipoHub() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Recursos Humanos y Logística</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Gestiona tu equipo, nóminas y rendimiento desde un solo lugar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Empleados Activos</h3>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">--</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Repartidores Activos</h3>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">--</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nómina del Mes</h3>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">S/ 0.00</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Evaluaciones Pendientes</h3>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">0</p>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">Accesos Rápidos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard/equipo/empleados" className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
              <Users className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Gestión de Empleados</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Administra roles, accesos y sucursales</p>
            </div>
          </div>
        </Link>
        <Link href="/dashboard/equipo/nominas" className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-300 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 transition-colors">
              <DollarSign className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Pagos y Nóminas</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Genera recibos de pago y bonos</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
