'use client'

import { useState } from 'react'
import { Package } from 'lucide-react'
import SettingsHeader from '../components/SettingsHeader'
import CategoriasTab from './components/CategoriasTab'
import TiersTab from './components/TiersTab'
import UnidadesTab from './components/UnidadesTab'

type Tab = 'categorias' | 'tiers' | 'unidades'

const TABS: { id: Tab; label: string }[] = [
  { id: 'categorias', label: 'Categorías' },
  { id: 'tiers', label: 'Descuentos x Cantidad' },
  { id: 'unidades', label: 'Unidades de Medida' },
]

export default function CatalogoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categorias')

  return (
    <div>
      <SettingsHeader
        title="Catálogo"
        description="Configura categorías, descuentos y unidades"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Catálogo' }]}
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
          {activeTab === 'categorias' && <CategoriasTab />}
          {activeTab === 'tiers' && <TiersTab />}
          {activeTab === 'unidades' && <UnidadesTab />}
        </div>
      </div>
    </div>
  )
}
