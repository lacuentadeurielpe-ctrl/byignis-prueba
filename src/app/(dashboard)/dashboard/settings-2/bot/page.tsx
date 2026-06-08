'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import SettingsHeader from '../components/SettingsHeader'
import BotPerfilTab from './components/BotPerfilTab'
import BotAgentesTab from './components/BotAgentesTab'
import BotComplementariosTab from './components/BotComplementariosTab'
import BotComportamientoTab from './components/BotComportamientoTab'

type Tab = 'perfil' | 'agentes' | 'complementarios' | 'comportamiento'

const TABS: { id: Tab; label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'agentes', label: 'Agentes' },
  { id: 'complementarios', label: 'Complementarios' },
  { id: 'comportamiento', label: 'Comportamiento' },
]

export default function BotPage() {
  const [activeTab, setActiveTab] = useState<Tab>('perfil')

  return (
    <div>
      <SettingsHeader
        title="Bot IA"
        description="Configura la personalidad y comportamiento del asistente"
        breadcrumbs={[{ label: 'ConfiguraciÃ³n' }, { label: 'Bot' }]}
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
          {activeTab === 'perfil' && <BotPerfilTab />}
          {activeTab === 'agentes' && <BotAgentesTab />}
          {activeTab === 'complementarios' && <BotComplementariosTab />}
          {activeTab === 'comportamiento' && <BotComportamientoTab />}
        </div>
      </div>
    </div>
  )
}
