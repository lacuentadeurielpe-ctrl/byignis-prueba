'use client'

import { useState } from 'react'
import SettingsHeader from '../../components/SettingsHeader'
import AvanzadoModulosTab from './components/AvanzadoModulosTab'
import AvanzadoPoliticasTab from './components/AvanzadoPoliticasTab'
import AvanzadoLogsTab from './components/AvanzadoLogsTab'

type Tab = 'modulos' | 'politicas' | 'backup' | 'logs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'modulos', label: 'Módulos' },
  { id: 'politicas', label: 'Políticas' },
  { id: 'backup', label: 'Backup' },
  { id: 'logs', label: 'Logs' },
]

export default function AvanzadoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('modulos')

  return (
    <div>
      <SettingsHeader
        title="Avanzado"
        description="Configuración avanzada"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Avanzado' }]}
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
          {activeTab === 'modulos' && <AvanzadoModulosTab />}
          {activeTab === 'politicas' && <AvanzadoPoliticasTab />}
          {activeTab === 'backup' && <div className="p-4 bg-zinc-50 rounded-lg text-sm text-zinc-600">Backup en desarrollo</div>}
          {activeTab === 'logs' && <AvanzadoLogsTab />}
        </div>
      </div>
    </div>
  )
}
