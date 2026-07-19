'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { X, LayoutDashboard, TrendingUp, ScanLine, Package, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import NotificationBadge from '@/components/layout/NotificationBadge'
import { checkPermiso, type PermisoMap, type Permiso } from '@/lib/auth/permisos'
import type { Rol } from '@/lib/auth/roles'
import { isModuleEnabled, type ModuleName } from '@/lib/config/modules'

// ── Tab bar principal (móvil) ─────────────────────────────────────────────────
const TAB_ITEMS: {
  label: string
  href: string
  icon: React.ElementType
  permiso: Permiso
  moduleName: ModuleName
  badge?: 'pedidos' | 'conversaciones'
  exact?: boolean
}[] = [
  { label: 'Inicio',  href: '/dashboard',              icon: LayoutDashboard, permiso: 'ver_dashboard', moduleName: 'dashboard', exact: true },
  { label: 'Ventas',  href: '/dashboard/ventas',       icon: TrendingUp,      permiso: 'ver_pedidos',   moduleName: 'ventas',    badge: 'pedidos' },
  { label: 'Caja POS', href: '/pos',                    icon: ScanLine,        permiso: 'ver_pedidos',   moduleName: 'pos' },
  { label: 'Catálogo', href: '/dashboard/catalog',      icon: Package,         permiso: 'ver_stock',     moduleName: 'catalog' },
]

interface MobileSidebarWrapperProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  nombreFerreteria?: string | null
  logoUrl?: string | null
  ferreteriaId: string
  pedidosPendientes: number
  conversacionesActivas: number
  rol: Rol
  permisos: PermisoMap
}

export default function MobileSidebarWrapper({
  sidebar,
  children,
  ferreteriaId,
  pedidosPendientes,
  conversacionesActivas,
  rol,
  permisos,
}: MobileSidebarWrapperProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

  const session      = { rol, permisos }
  const tabsVisibles = TAB_ITEMS.filter((t) => 
    checkPermiso(session, t.permiso) && isModuleEnabled(t.moduleName)
  )

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-background text-foreground transition-ui">

      {/* ── Sidebar — solo desktop ──────────────────────────────────────── */}
      <div className="hidden md:flex md:shrink-0">
        {sidebar}
      </div>

      {/* ── Overlay drawer móvil ────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Drawer móvil (sidebar completo desde la izquierda) ─────────── */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ease-in-out',
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="relative h-full">
          {sidebar}
          <button
            onClick={() => setDrawerOpen(false)}
            className="absolute top-4 right-[-40px] w-8 h-8 bg-white dark:bg-zinc-900 rounded-r-xl shadow-sm
                       border border-l-0 border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 transition-ui"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 relative overflow-auto md:pb-0 pb-16">
          {children}
        </main>

        {/* ── Bottom tab bar — solo móvil ─────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-glass-border shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
          <div className="flex items-stretch h-16">

            {tabsVisibles.map(({ label, href, icon: Icon, badge, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-1 relative transition-ui py-2',
                    active ? 'text-primary font-bold' : 'text-zinc-400 hover:text-zinc-600'
                  )}
                >
                  {/* Indicador activo — línea superior */}
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_0_8px_var(--color-primary)]" />
                  )}

                  {/* Icono + badge */}
                  <div className="relative mt-1">
                    <Icon className={cn('w-5 h-5 transition-ui', active ? 'text-primary scale-110' : 'text-zinc-400')} />
                    {badge && (
                      <div className="absolute -top-1.5 -right-2 pointer-events-none">
                        <NotificationBadge
                          ferreteriaId={ferreteriaId}
                          tipo={badge}
                          initialCount={badge === 'pedidos' ? pedidosPendientes : conversacionesActivas}
                        />
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </Link>
              )
            })}

            {/* Más — abre el drawer con la navegación completa */}
            <button
              onClick={() => setDrawerOpen(true)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 relative transition-ui py-2',
                drawerOpen ? 'text-primary font-bold' : 'text-zinc-400 hover:text-zinc-600'
              )}
            >
              {drawerOpen && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_0_8px_var(--color-primary)]" />
              )}
              <div className="relative mt-1">
                <MoreHorizontal className={cn('w-5 h-5 transition-ui', drawerOpen ? 'text-primary scale-110' : 'text-zinc-400')} />
              </div>
              <span className="text-[10px] font-medium leading-none">Más</span>
            </button>

          </div>
        </nav>
      </div>

    </div>
  )
}
