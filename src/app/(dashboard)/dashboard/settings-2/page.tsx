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
        description="Panel de control centralizado para tu negocio"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Setup Checklist */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpandedChecklist(!expandedChecklist)}
            className="w-full px-6 py-5 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white hover:from-zinc-100 hover:to-zinc-50 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-5 flex-1">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold text-zinc-900">Setup Inicial</h2>
                  <div className="h-5 px-2.5 bg-indigo-100 text-indigo-700 rounded-full flex items-center">
                    <span className="text-xs font-bold">{completed}/{CHECKLIST.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="w-32 h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 min-w-10">{progress}%</span>
                </div>
              </div>
            </div>
            {expandedChecklist ? (
              <ChevronUp className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            )}
          </button>

          {expandedChecklist && (
            <div className="divide-y divide-zinc-100 bg-white">
              {CHECKLIST.map((item, idx) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="px-6 py-4 hover:bg-indigo-50 transition flex items-start gap-4 group"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item.completed ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center shadow-sm">
                        <span className="text-emerald-700 text-sm font-bold">✓</span>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-zinc-300 group-hover:border-indigo-400 transition" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium transition ${item.completed ? 'text-zinc-500 line-through' : 'text-zinc-900 group-hover:text-indigo-600'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
                  </div>
                  {!item.completed && <ArrowRight className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition" />}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Module Status Grid */}
        <div>
          <h3 className="text-sm font-bold text-zinc-900 mb-5">Módulos de Configuración</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULES.map(module => {
              const statusBg = {
                completo: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-100',
                incompleto: 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 hover:shadow-zinc-100',
                alerta: 'bg-amber-50 border-amber-200 hover:border-amber-300 hover:shadow-amber-100',
              }[module.status]

              const statusIndicator = {
                completo: { color: 'text-emerald-600', bg: 'bg-emerald-100' },
                incompleto: { color: 'text-zinc-600', bg: 'bg-zinc-100' },
                alerta: { color: 'text-amber-600', bg: 'bg-amber-100' },
              }[module.status]

              return (
                <Link
                  key={module.id}
                  href={module.href}
                  className={`border rounded-xl p-5 transition hover:shadow-md group cursor-pointer ${statusBg}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl group-hover:scale-110 transition duration-200">{module.icon}</span>
                    <div className={`w-7 h-7 rounded-full ${statusIndicator.bg} flex items-center justify-center`}>
                      <span className={`text-sm font-bold ${statusIndicator.color}`}>{module.statusLabel}</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-600 transition">{module.name}</p>
                  {module.statusDetail && (
                    <p className={`text-xs mt-2 ${STATUS_TEXT[module.status]} line-clamp-2`}>{module.statusDetail}</p>
                  )}
                  {module.count && (
                    <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-full">
                      <span>⚠️</span>
                      {module.count} activo{module.count !== '1' ? 's' : ''}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Recommended Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-zinc-900 mb-4">Acciones recomendadas</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-zinc-700 group">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5">1.</span>
                  <div className="flex-1">
                    Completa tu RUC para habilitar facturación automática
                    <Link href="/dashboard/settings-2/finanzas" className="ml-2 text-blue-600 font-semibold hover:text-blue-700 inline-flex items-center gap-1 group-hover:gap-2 transition">
                      Ir <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-sm text-zinc-700 group">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5">2.</span>
                  <div className="flex-1">
                    Revisa tu token Mercado Pago (vence en 8 días)
                    <Link href="/dashboard/settings-2/integraciones" className="ml-2 text-blue-600 font-semibold hover:text-blue-700 inline-flex items-center gap-1 group-hover:gap-2 transition">
                      Ir <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
