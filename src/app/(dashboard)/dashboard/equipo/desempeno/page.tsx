'use client'

import { LineChart as ChartIcon, Trophy, Target, AlertCircle } from 'lucide-react'

export default function DesempenoPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Desempeño del Equipo (Global)</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Métricas generales de la productividad de todas las sucursales.</p>
        </div>
        <button className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:bg-zinc-800 transition">
          Iniciar Ciclo de Evaluación
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between">
            <p className="text-sm font-medium text-zinc-500">Puntualidad Global</p>
            <ChartIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-zinc-900 mt-2">94%</p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">+2% respecto al mes anterior</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between">
            <p className="text-sm font-medium text-zinc-500">Metas Alcanzadas</p>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-zinc-900 mt-2">8/14</p>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Empleados superaron cuota</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between">
            <p className="text-sm font-medium text-zinc-500">Empleado del Mes</p>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-xl font-bold text-zinc-900 mt-2">Carlos M.</p>
          <p className="text-xs text-yellow-600 mt-1 font-medium">Top Ventas Mostrador</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between">
            <p className="text-sm font-medium text-zinc-500">Alertas Activas</p>
            <AlertCircle className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-orange-600 mt-2">3</p>
          <p className="text-xs text-orange-600 mt-1 font-medium">Llamados de atención recientes</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
          <h3 className="font-bold text-zinc-900 text-lg">Ranking de Desempeño</h3>
          <p className="text-sm text-zinc-500">Listado de los empleados con mejor rendimiento este mes.</p>
        </div>
        <div className="p-6 text-center text-zinc-500 text-sm">
          Aún no hay suficientes datos para generar el ranking mensual. Asegúrate de evaluar individualmente a cada empleado desde su perfil (Pestaña "Empleados").
        </div>
      </div>
    </div>
  )
}
