'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Zap, Users, DollarSign, Bot, Package, Truck, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  status?: 'completo' | 'incompleto' | 'alerta'
  count?: string | number
}

const BASE = '/dashboard/settings-2/sections'

const SECTIONS: NavItem[] = [
  {
    id: 'negocio',
    label: 'Negocio',
    href: `${BASE}/negocio`,
    icon: <Building2 className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'integraciones',
    label: 'Integraciones',
    href: `${BASE}/integraciones`,
    icon: <Zap className="w-5 h-5" />,
    status: 'alerta',
    count: 3,
  },
  {
    id: 'equipo',
    label: 'Equipo',
    href: `${BASE}/equipo`,
    icon: <Users className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    href: `${BASE}/finanzas`,
    icon: <DollarSign className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'bot',
    label: 'Bot AI',
    href: `${BASE}/bot`,
    icon: <Bot className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    href: `${BASE}/catalogo`,
    icon: <Package className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    href: `${BASE}/delivery`,
    icon: <Truck className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'avanzado',
    label: 'Avanzado',
    href: `${BASE}/avanzado`,
    icon: <Settings className="w-5 h-5" />,
    status: 'incompleto',
  },
]

const STATUS_ICON = {
  completo: '✓',
  incompleto: '○',
  alerta: '⚠️',
}

const STATUS_COLOR = {
  completo: 'text-emerald-600',
  incompleto: 'text-zinc-400',
  alerta: 'text-amber-600',
}

export default function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-64 bg-white border-r border-zinc-200 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-b from-white to-zinc-50 border-b border-zinc-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-indigo-600" />
          <h2 className="text-sm font-bold text-zinc-900">Configuración</h2>
        </div>
        <p className="text-xs text-zinc-500 pl-4">Gestión de empresa</p>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 px-3 py-4 space-y-1">
        {SECTIONS.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const statusColorMap = {
            completo: 'text-emerald-600',
            incompleto: 'text-zinc-400',
            alerta: 'text-amber-600',
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition relative group',
                isActive
                  ? `bg-indigo-50 text-indigo-700 border border-indigo-200`
                  : 'text-zinc-700 hover:bg-zinc-50 border border-transparent'
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={cn('transition', isActive ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600')}>
                  {item.icon}
                </div>
                <span className="flex-1">{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.count && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                    {item.count}
                  </span>
                )}
                {item.status && (
                  <span className={`text-sm font-bold ${statusColorMap[item.status] || 'text-zinc-400'}`}>{STATUS_ICON[item.status]}</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 p-4 mt-auto">
        <p className="text-xs text-zinc-500 text-center">
          ✓ {SECTIONS.filter(s => s.status === 'completo').length}/8 completados
        </p>
      </div>
    </nav>
  )
}
