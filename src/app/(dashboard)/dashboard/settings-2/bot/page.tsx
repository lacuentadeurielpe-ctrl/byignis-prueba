'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import SettingsHeader from '../components/SettingsHeader'
import BotPerfilTab from './components/BotPerfilTab'
import BotAgentesTab from './components/BotAgentesTab'
import BotComplementariosTab from './components/BotComplementariosTab'
import BotComportamientoTab from './components/BotComportamientoTab'
import BotPromptTab from './components/BotPromptTab'
import AsistenteTab from '@/components/asistente/AsistenteTab'

type Tab = 'perfil' | 'agentes' | 'complementarios' | 'comportamiento' | 'prompt' | 'asistente'

const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: 'perfil',          label: 'Perfil' },
  { id: 'agentes',         label: 'Agentes' },
  { id: 'complementarios', label: 'Complementarios' },
  { id: 'comportamiento',  label: 'Comportamiento' },
  { id: 'prompt',          label: 'Prompt' },
  { id: 'asistente',       label: 'Asistente IA', badge: 'nuevo' },
]

export default function BotPage() {
  const [activeTab, setActiveTab] = useState<Tab>('perfil')

  return (
    <div>
      <SettingsHeader
        title="Bot IA"
        description="Configura la personalidad y comportamiento del asistente"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Bot' }]}
      />

      <div className={`p-6 space-y-6 ${activeTab === 'asistente' ? 'max-w-full' : 'max-w-6xl'}`}>
        <div className="border-b border-zinc-200">
          <div className="flex gap-1 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={activeTab === 'asistente' ? '' : 'pt-4'}>
          {activeTab === 'perfil'          && <BotPerfilTab />}
          {activeTab === 'agentes'         && <BotAgentesTab />}
          {activeTab === 'complementarios' && <BotComplementariosTab />}
          {activeTab === 'comportamiento'  && <BotComportamientoTab />}
          {activeTab === 'prompt'          && <BotPromptTab />}
          {activeTab === 'asistente'       && <AsistenteTab />}
        </div>
      </div>
    </div>
  )
}
