'use client'

import { LineChart } from 'lucide-react'

export default function DesempenoPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Desempeño y Métricas</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Analiza el rendimiento de empleados y repartidores.</p>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center shadow-sm">
        <LineChart className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Módulo en Construcción</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto">
          Próximamente podrás ver reportes de KPIs, tiempos de entrega y puntuaciones globales por empleado.
        </p>
      </div>
    </div>
  )
}
