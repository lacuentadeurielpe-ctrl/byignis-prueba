'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Truck, ReceiptText, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard/equipo', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/equipo/empleados', label: 'Empleados', icon: Users },
  { href: '/dashboard/equipo/repartidores', label: 'Repartidores', icon: Truck },
  { href: '/dashboard/equipo/nominas', label: 'Nóminas', icon: ReceiptText },
  { href: '/dashboard/equipo/desempeno', label: 'Desempeño', icon: LineChart },
]

export default function EquipoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-background">
      {/* ── Navbar Módulo Equipo ── */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 md:px-6">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pt-4">
          {TABS.map(tab => {
            const isActive = tab.exact 
              ? pathname === tab.href 
              : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-background">
        {children}
      </div>
    </div>
  )
}
