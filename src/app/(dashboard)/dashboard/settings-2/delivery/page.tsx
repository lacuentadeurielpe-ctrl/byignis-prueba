'use client'

import { useState } from 'react'
import SettingsHeader from '../components/SettingsHeader'
import DeliveryZonasTab from './components/DeliveryZonasTab'
import DeliveryVehiculosTab from './components/DeliveryVehiculosTab'
import DeliveryIntelligenceTab from './components/DeliveryIntelligenceTab'

type Tab = 'zonas' | 'vehiculos' | 'inteligencia'

const TABS: { id: Tab; label: string }[] = [
  { id: 'zonas', label: 'Zonas de Entrega' },
  { id: 'vehiculos', label: 'Vehículos' },
  { id: 'inteligencia', label: 'Inteligencia IA' },
]

export default function DeliveryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('zonas')

  return (
    <div>
      <SettingsHeader
        title="Delivery"
        description="Gestiona zonas, vehículos e inteligencia de entregas"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Delivery' }]}
      />

      <div className="p-4 md:p-6 max-w-6xl space-y-4 md:space-y-6">
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
          {activeTab === 'zonas' && <DeliveryZonasTab />}
          {activeTab === 'vehiculos' && <DeliveryVehiculosTab />}
          {activeTab === 'inteligencia' && <DeliveryIntelligenceTab />}
        </div>
      </div>
    </div>
  )
}
