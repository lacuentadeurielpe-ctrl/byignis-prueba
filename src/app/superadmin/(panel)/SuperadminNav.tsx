'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SuperadminSession } from '@/lib/auth/superadmin'
import {
  LayoutDashboard,
  Store,
  PackageCheck,
  Bot,
  HeartPulse,
  LogOut,
  DollarSign,
  Shield,
  Settings,
} from 'lucide-react'

interface Props {
  session: SuperadminSession
}

const NAV_ITEMS = [
  { href: '/superadmin',            label: 'Dashboard',  Icon: LayoutDashboard },
  { href: '/superadmin/tenants',    label: 'Tenants',    Icon: Store },
  { href: '/superadmin/planes',     label: 'Planes',     Icon: PackageCheck },
  { href: '/superadmin/ia',         label: 'Economía IA', Icon: Bot },
  { href: '/superadmin/billing',    label: 'Billing',    Icon: DollarSign },
  { href: '/superadmin/seguridad',  label: 'Seguridad',  Icon: Shield },
  { href: '/superadmin/salud',      label: 'Salud',      Icon: HeartPulse },
  { href: '/superadmin/config',     label: 'Config',     Icon: Settings },
]

export default function SuperadminNav({ session }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/superadmin/login')
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/uintegrus_favicon.svg" alt="Uintegrus" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-white">Uintegrus</span>
          <span className="text-gray-600 text-xs border border-gray-700 rounded px-1.5 py-0.5">Superadmin</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/superadmin'
              ? pathname === '/superadmin'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-800 text-white font-medium border-b-2 border-indigo-500 rounded-b-none'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <item.Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Sesión */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white">{session.nombre}</p>
            <p className="text-xs text-gray-500">{session.nivel}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
