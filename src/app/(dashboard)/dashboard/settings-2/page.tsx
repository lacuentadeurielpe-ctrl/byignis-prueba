'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ArrowRight, AlertCircle } from 'lucide-react'
import SettingsHeader from './components/SettingsHeader'

interface ChecklistItem {
  id: string
  title: string
  description: string
  completed: boolean
  href: string
}

interface ModuleStatus {
  id: string
  name: string
  status: 'completo' | 'incompleto' | 'alerta'
  statusLabel: string
  statusDetail?: string
  icon: string
  count?: string
  href: string
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: '1',
    title: 'Configura datos de la empresa',
    description: 'Nombre, dirección, teléfono, horarios',
    completed: true,
    href: '/dashboard/settings-2/negocio',
  },
  {
    id: '2',
    title: 'Conecta WhatsApp (YCloud)',
    description: 'API key y webhook secret',
    completed: true,
    href: '/dashboard/settings-2/integraciones',
  },
  {
    id: '3',
    title: 'Configura facturación (RUC, régimen)',
    description: 'Completar datos tributarios',
    completed: false,
    href: '/dashboard/settings-2/finanzas',
  },
  {
    id: '4',
    title: 'Agrega tu equipo',
    description: 'Empleados y repartidores',
    completed: false,
    href: '/dashboard/settings-2/equipo',
  },
  {
    id: '5',
    title: 'Carga tu catálogo',
    description: 'Productos y categorías',
    completed: true,
    href: '/dashboard/settings-2/catalogo',
  },
]

const MODULES: ModuleStatus[] = [
  {
    id: 'negocio',
    name: 'Negocio',
    status: 'completo',
    statusLabel: '✓',
    href: '/dashboard/settings-2/negocio',
    icon: '🏢',
  },
  {
    id: 'integraciones',
    name: 'Integraciones',
    status: 'alerta',
    statusLabel: '⚠️',
    statusDetail: 'MP token vence 2026-06-15',
    href: '/dashboard/settings-2/integraciones',
    icon: '🔗',
    count: '3',
  },
  {
    id: 'equipo',
    name: 'Equipo',
    status: 'incompleto',
    statusLabel: '○',
    statusDetail: 'Falta agregar empleados',
    href: '/dashboard/settings-2/equipo',
    icon: '👥',
  },
  {
    id: 'finanzas',
    name: 'Finanzas',
    status: 'incompleto',
    statusLabel: '○',
    statusDetail: 'Falta completar RUC',
    href: '/dashboard/settings-2/finanzas',
    icon: '💰',
  },
  {
    id: 'bot',
    name: 'Bot AI',
    status: 'completo',
    statusLabel: '✓',
    href: '/dashboard/settings-2/bot',
    icon: '🤖',
  },
  {
    id: 'catalogo',
    name: 'Catálogo',
    status: 'completo',
    statusLabel: '✓',
    statusDetail: '120 productos',
    href: '/dashboard/settings-2/catalogo',
    icon: '📦',
  },
  {
    id: 'delivery',
    name: 'Delivery',
    status: 'completo',
    statusLabel: '✓',
    statusDetail: '5 zonas configuradas',
    href: '/dashboard/settings-2/delivery',
    icon: '🚚',
  },
  {
    id: 'avanzado',
    name: 'Avanzado',
    status: 'incompleto',
    statusLabel: '○',
    href: '/dashboard/settings-2/avanzado',
    icon: '⚙️',
  },
]

export default function Settings2Hub() {
  const [expandedChecklist, setExpandedChecklist] = useState(true)
  const completed = CHECKLIST.filter(i => i.completed).length
  const progress = Math.round((completed / CHECKLIST.length) * 100)

  const STATUS_COLORS = {
    completo: 'bg-emerald-50 border-emerald-200',
    incompleto: 'bg-zinc-50 border-zinc-200',
    alerta: 'bg-amber-50 border-amber-200',
  }

  const STATUS_TEXT = {
    completo: 'text-emerald-700',
    incompleto: 'text-zinc-600',
    alerta: 'text-amber-700',
  }

  return (
    <div>
      <SettingsHeader
        title="Configuración"
        description="Gestiona todos los aspectos de tu ferretería desde aquí"
      />

      <div className="p-6 space-y-6">
        {/* Setup Checklist */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpandedChecklist(!expandedChecklist)}
            className="w-full px-6 py-4 border-b border-zinc-100 bg-zinc-50 hover:bg-zinc-100 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-zinc-900">Setup Checklist</h2>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-zinc-600">{progress}%</span>
                </div>
              </div>
            </div>
            {expandedChecklist ? (
              <ChevronUp className="w-5 h-5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-zinc-400" />
            )}
          </button>

          {expandedChecklist && (
            <div className="divide-y divide-zinc-100">
              {CHECKLIST.map(item => (
                <div key={item.id} className="p-4 hover:bg-zinc-50 transition">
                  <Link href={item.href} className="flex items-start gap-4">
                    <div className="mt-1">
                      {item.completed ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                          <span className="text-emerald-700 text-xs font-bold">✓</span>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-zinc-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${item.completed ? 'text-zinc-900 line-through' : 'text-indigo-600'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-300 mt-1 flex-shrink-0" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Module Status Grid */}
        <div>
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Estado de Módulos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULES.map(module => (
              <Link
                key={module.id}
                href={module.href}
                className={`border rounded-xl p-4 transition hover:shadow-md ${STATUS_COLORS[module.status]}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{module.icon}</span>
                  <span className="text-xl">{module.statusLabel}</span>
                </div>
                <p className="text-sm font-semibold text-zinc-900">{module.name}</p>
                {module.statusDetail && (
                  <p className={`text-xs mt-2 ${STATUS_TEXT[module.status]}`}>{module.statusDetail}</p>
                )}
                {module.count && (
                  <div className="mt-3 inline-block px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                    {module.count} alertas
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-blue-900 mb-2">Próximas acciones recomendadas</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>
                  • Completa tu configuración de RUC para habilitar facturación automática →{' '}
                  <Link href="/dashboard/settings-2/finanzas" className="font-bold text-blue-700 hover:underline">
                    Ir a Finanzas
                  </Link>
                </li>
                <li>
                  • Revisa el estado de tu token Mercado Pago, vence en 8 días →{' '}
                  <Link href="/dashboard/settings-2/integraciones" className="font-bold text-blue-700 hover:underline">
                    Ir a Integraciones
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
