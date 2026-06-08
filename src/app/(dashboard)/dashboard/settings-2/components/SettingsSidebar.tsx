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

const SECTIONS: NavItem[] = [
  {
    id: 'negocio',
    label: 'Negocio',
    href: '/dashboard/settings-2/negocio',
    icon: <Building2 className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'integraciones',
    label: 'Integraciones',
    href: '/dashboard/settings-2/integraciones',
    icon: <Zap className="w-5 h-5" />,
    status: 'alerta',
    count: 3,
  },
  {
    id: 'equipo',
    label: 'Equipo',
    href: '/dashboard/settings-2/equipo',
    icon: <Users className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    href: '/dashboard/settings-2/finanzas',
    icon: <DollarSign className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'bot',
    label: 'Bot AI',
    href: '/dashboard/settings-2/bot',
    icon: <Bot className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    href: '/dashboard/settings-2/catalogo',
    icon: <Package className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    href: '/dashboard/settings-2/delivery',
    icon: <Truck className="w-5 h-5" />,
    status: 'completo',
  },
  {
    id: 'avanzado',
    label: 'Avanzado',
    href: '/dashboard/settings-2/avanzado',
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
    <nav className="w-64 bg-white border-r border-zinc-200 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-zinc-100 p-4">
        <h2 className="text-sm font-bold text-zinc-900">Configuración</h2>
        <p className="text-xs text-zinc-500 mt-1">Gestión de empresa</p>
      </div>

      <div className="p-4 space-y-1">
        {SECTIONS.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-zinc-700 hover:bg-zinc-50 border border-transparent'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={isActive ? 'text-indigo-600' : 'text-zinc-400'}>{item.icon}</div>
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.count && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                    {item.count}
                  </span>
                )}
                {item.status && (
                  <span className={`text-lg ${STATUS_COLOR[item.status]}`}>{STATUS_ICON[item.status]}</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
