'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import SettingsHeader from '../../components/SettingsHeader'
import EmpleadosTab from './components/EmpleadosTab'
import RepartidoresTab from './components/RepartidoresTab'

type Tab = 'empleados' | 'repartidores' | 'permisos' | 'auditoria'

const TABS: { id: Tab; label: string }[] = [
  { id: 'empleados', label: 'Empleados' },
  { id: 'repartidores', label: 'Repartidores' },
  { id: 'permisos', label: 'Permisos' },
  { id: 'auditoria', label: 'Auditoría' },
]

export default function EquipoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('empleados')

  return (
    <div>
      <SettingsHeader
        title="Equipo"
        description="Gestiona empleados, repartidores y permisos"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Equipo' }]}
      />

      <div className="p-6 max-w-6xl space-y-6">
        <div className="border-b border-zinc-200">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4">
          {activeTab === 'empleados' && <EmpleadosTab />}
          {activeTab === 'repartidores' && <RepartidoresTab />}
          {activeTab === 'permisos' && (
            <div className="p-4 bg-zinc-50 rounded-lg text-sm text-zinc-600">
              Matriz de permisos - en desarrollo
            </div>
          )}
          {activeTab === 'auditoria' && (
            <div className="p-4 bg-zinc-50 rounded-lg text-sm text-zinc-600">
              Log de auditoría - en desarrollo
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
