'use client'

import { ReceiptText } from 'lucide-react'

export default function NominasPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Nóminas y Pagos (Global)</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Genera recibos masivos y controla el flujo de caja del equipo.</p>
        </div>
        <button className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:bg-zinc-800 transition">
          Generar Nómina Masiva
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Próximo Pago (Quincena)</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">15 Julio</p>
          <p className="text-sm text-indigo-600 mt-1 font-medium">S/ 12,450.00 estimados</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Empleados Activos en Nómina</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">14</p>
          <p className="text-sm text-zinc-500 mt-1">8 formales / 6 internos</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Pagos Pendientes (Junio)</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">2</p>
          <p className="text-sm text-orange-600 mt-1 font-medium">Revisar liquidaciones</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
          <h3 className="font-bold text-zinc-900 text-lg">Historial de Lotes de Pago</h3>
          <p className="text-sm text-zinc-500">Lotes de nóminas generadas masivamente.</p>
        </div>
        <div className="divide-y divide-zinc-100 p-6 text-center">
          <ReceiptText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600">Aún no has generado tu primer lote de pago masivo.</p>
          <p className="text-xs text-zinc-500 mt-1">Si deseas configurar un pago individual, ingresa al perfil de cada empleado desde la pestaña "Empleados".</p>
        </div>
      </div>
    </div>
  )
}
