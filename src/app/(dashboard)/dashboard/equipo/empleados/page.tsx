'use client'

import EmpleadosTab from '../components/EmpleadosTab'

export default function EmpleadosPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Gestión de Empleados</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Administra accesos, roles y sucursales asignadas.</p>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <EmpleadosTab />
      </div>
    </div>
  )
}
