'use client'

import RepartidoresTab from '../components/RepartidoresTab'

export default function RepartidoresPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Gestión de Repartidores</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Administra vehículos, zonas y perfiles de repartidores.</p>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <RepartidoresTab />
      </div>
    </div>
  )
}
