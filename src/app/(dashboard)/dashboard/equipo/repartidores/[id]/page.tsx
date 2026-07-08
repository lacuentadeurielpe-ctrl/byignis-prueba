'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, User, ReceiptText, LineChart, Truck } from 'lucide-react'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'datos', label: 'Datos Personales', icon: User },
  { id: 'logistica', label: 'Logística', icon: Truck },
  { id: 'nominas', label: 'Historial de Nómina', icon: ReceiptText },
  { id: 'desempeno', label: 'Desempeño', icon: LineChart },
]

export default function RepartidorProfilePage() {
  const params = useParams()
  const id = params.id as string
  const [activeTab, setActiveTab] = useState('datos')

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header Perfil ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <Link href="/dashboard/equipo/repartidores" className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-zinc-500 self-start">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-2xl">
            {id ? id.substring(0,2).toUpperCase() : 'RE'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Perfil del Repartidor</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">ID: {id}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs Navegación ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Contenido Tabs ── */}
        <div className="p-6">
          {activeTab === 'datos' && (
             <div className="text-zinc-600 dark:text-zinc-400 text-sm">Formulario de datos personales y PIN de acceso en construcción...</div>
          )}
          {activeTab === 'logistica' && (
             <div className="text-zinc-600 dark:text-zinc-400 text-sm">Asignación de vehículos, zonas de cobertura y sucursal base en construcción...</div>
          )}
          {activeTab === 'nominas' && (
             <div className="text-zinc-600 dark:text-zinc-400 text-sm">Historial de pagos y liquidaciones en construcción...</div>
          )}
          {activeTab === 'desempeno' && (
             <div className="text-zinc-600 dark:text-zinc-400 text-sm">Métricas de tiempo de entrega, efectividad y reportes en construcción...</div>
          )}
        </div>
      </div>
    </div>
  )
}
