'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Settings,
  LogOut,
  Users,
  Camera,
  Loader2,
  TrendingUp,
  BarChart2,
  Truck,
  ScanLine,
  FileText,
  Megaphone,
  LayoutTemplate,
} from 'lucide-react'
import NotificationBadge from '@/components/layout/NotificationBadge'
import SucursalSelector from '@/components/sucursales/SucursalSelector'
import type { ContextoSucursal } from '@/lib/sucursales/contexto'
import type { Rol } from '@/lib/auth/roles'
import { checkPermiso, type Permiso, type PermisoMap } from '@/lib/auth/permisos'
import { ThemeToggle } from '@/components/ThemeToggle'
import { isModuleEnabled, type ModuleName } from '@/lib/config/modules'
import { isModuleEnabledForSucursal } from '@/lib/sucursales/modulos'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: 'pedidos' | 'conversaciones' | 'cotizaciones'
  permiso?: Permiso
  moduleName?: ModuleName
  requireProPlan?: boolean
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard',       icon: LayoutDashboard, permiso: 'ver_dashboard', moduleName: 'dashboard' },
      { label: 'Caja POS',  href: '/pos',             icon: ScanLine,        permiso: 'ver_pedidos', moduleName: 'pos' },
      { label: 'Ventas',    href: '/dashboard/ventas', icon: TrendingUp,      badge: 'pedidos',        permiso: 'ver_pedidos', moduleName: 'ventas' },
      { label: 'Chat',      href: '/dashboard/conversations', icon: MessageSquare, badge: 'conversaciones', permiso: 'ver_pedidos', moduleName: 'chat', requireProPlan: true },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { label: 'Catálogo',  href: '/dashboard/catalog',   icon: Package,    permiso: 'ver_stock', moduleName: 'catalog' },
      { label: 'Clientes',  href: '/dashboard/clientes',  icon: Users,      permiso: 'ver_historial_clientes', moduleName: 'clientes' },
      { label: 'Equipo',    href: '/dashboard/equipo',    icon: Users,      permiso: 'configurar_ferreteria' },
      { label: 'Difusiones', href: '/dashboard/difusiones', icon: Megaphone, permiso: 'ver_pedidos', moduleName: 'chat', requireProPlan: true },
      { label: 'Plantillas WA', href: '/dashboard/plantillas-wa', icon: LayoutTemplate, permiso: 'ver_pedidos', moduleName: 'chat', requireProPlan: true },
      { label: 'Delivery',  href: '/dashboard/delivery',  icon: Truck,      permiso: 'delivery_ver_pedidos', moduleName: 'delivery', requireProPlan: true },
    ],
  },
  {
    items: [
      { label: 'Facturación', href: '/dashboard/comprobantes', icon: FileText, permiso: 'ver_caja_dia', moduleName: 'comprobantes' },
      { label: 'Finanzas', href: '/dashboard/finanzas', icon: BarChart2, permiso: 'ver_caja_dia', moduleName: 'finanzas' },
      { label: 'Ajustes',  href: '/dashboard/settings-2', icon: Settings,  permiso: 'configurar_ferreteria', moduleName: 'settings-2' },
    ],
  },
]

interface SidebarProps {
  nombreFerreteria: string | null
  ferreteriaId: string
  logoUrl?: string | null
  pedidosPendientes: number
  conversacionesActivas: number
  cotizacionesPendientes: number
  rol: Rol
  permisos: PermisoMap
  contextoSucursal?: ContextoSucursal | null
  planId?: string | null
}

export default function Sidebar({
  nombreFerreteria,
  ferreteriaId,
  logoUrl,
  pedidosPendientes,
  conversacionesActivas,
  cotizacionesPendientes,
  rol,
  permisos,
  contextoSucursal,
  planId,
}: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [logoLocal,    setLogoLocal]    = useState<string | null | undefined>(logoUrl)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // IDs de planes Pro y Vitalicio
  const isProOrVitalicio = planId === '2cb9bb87-c734-4374-92e0-2d37d010eb2e' || planId === 'bc7f4803-e34b-4de6-8d33-4475c7c67429'

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        setLogoLocal(url)
        router.refresh()
      }
    } finally {
      setSubiendoLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const session = { rol, permisos }

  function isActive(href: string) {
    // Para links con query params (ej: /dashboard/ventas?tab=deudas)
    if (href.includes('?')) {
      const [hrefPath, hrefQuery] = href.split('?')
      if (!pathname.startsWith(hrefPath)) return false
      if (typeof window === 'undefined') return false
      const sp = new URLSearchParams(window.location.search)
      const hsp = new URLSearchParams(hrefQuery)
      return Array.from(hsp.entries()).every(([k, v]) => sp.get(k) === v)
    }
    // Para /dashboard/ventas: no marcar activo cuando tab=deudas está activo
    if (href === '/dashboard/ventas' && typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('tab') === 'deudas') return false
    }
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href)
  }

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 h-full flex flex-col z-40 relative transition-ui">

      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800 transition-ui">
        <div className="flex items-center gap-3">

          {/* Logo — clickeable para el dueño */}
          <div className="relative shrink-0 group transition-ui hover:scale-105">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-900 shadow-sm flex items-center justify-center border border-zinc-200/50 dark:border-zinc-800 shrink-0">
              {subiendoLogo
                ? <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                : logoLocal
                  ? <img src={logoLocal} alt="Logo" className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-zinc-600 select-none">
                      {(nombreFerreteria ?? 'M')[0].toUpperCase()}
                    </span>
              }
            </div>
            {rol === 'dueno' && !subiendoLogo && (
              <>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  title="Cambiar logo"
                  className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100
                             transition flex items-center justify-center"
                >
                  <Camera className="w-3.5 h-3.5 text-white" />
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </>
            )}
          </div>

          <div className="min-w-0 flex-1 transition-ui">
            <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 truncate leading-tight">
              {nombreFerreteria ?? 'Mi negocio'}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              {rol === 'dueno' ? (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="hover:text-zinc-600 transition"
                >
                  {logoLocal ? 'Cambiar logo' : 'Subir logo'}
                </button>
              ) : 'Empleado'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Sucursal activa (solo con multi_sucursal) ──────────────────── */}
      {contextoSucursal && (
        <div className="pt-2">
          <SucursalSelector contexto={contextoSucursal} />
        </div>
      )}

      {/* ── Navegación ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navGroups.map((group, gi) => {
          const visibles = group.items.filter((item) => {
            if (item.requireProPlan && !isProOrVitalicio) return false
            const hasPerm = !item.permiso || checkPermiso(session, item.permiso)
            const isEnabled = !item.moduleName || isModuleEnabled(item.moduleName)
            // Verificación modular por sucursal: hoy siempre true,
            // hook preparado para restricciones granulares por sucursal en el futuro.
            const isEnabledForSucursal = !item.moduleName ||
              isModuleEnabledForSucursal(item.moduleName, contextoSucursal ?? null)
            return hasPerm && isEnabled && isEnabledForSucursal
          })
          if (visibles.length === 0) return null

          return (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider select-none">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibles.map(({ label, href, icon: Icon, badge }) => {
                  const active = isActive(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                        active
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-sm'
                          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
                      )}
                    >
                      <Icon className={cn(
                        'w-[18px] h-[18px] shrink-0 transition-all duration-200',
                        active ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                      )} />
                      <span className="truncate flex-1">{label}</span>
                      {badge && (
                        <NotificationBadge
                          ferreteriaId={ferreteriaId}
                          tipo={badge}
                          initialCount={
                            badge === 'pedidos'        ? pedidosPendientes
                            : badge === 'cotizaciones' ? cotizacionesPendientes
                            : conversacionesActivas
                          }
                        />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Footer de Sidebar ──────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 transition-ui">
        <button
          onClick={handleLogout}
          className="flex flex-1 items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                     text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-ui group"
        >
          <LogOut className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-ui" />
          <span>Cerrar sesión</span>
        </button>
        <ThemeToggle />
      </div>

    </aside>
  )
}
