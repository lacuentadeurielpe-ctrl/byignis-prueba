// /superadmin — Dashboard con métricas globales de la plataforma

import Link from 'next/link'
import { getSuperadminSession } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { inicioDiaLima } from '@/lib/tiempo'

export const dynamic = 'force-dynamic'

async function getStats() {
  const admin = createAdminClient()
  const inicioSem = inicioDiaLima(-7)

  const [
    { data: ferreterias },
    { data: suscripciones },
    { data: pedidos }
  ] = await Promise.all([
    admin.from('ferreterias').select('id, nombre, estado_tenant, created_at'),
    admin.from('suscripciones').select('ferreteria_id, estado'),
    admin.from('pedidos').select('ferreteria_id, total, costo_total').eq('estado', 'entregado')
  ])

  const lista = ferreterias ?? []
  const suscs = suscripciones ?? []
  const peds = pedidos ?? []

  // Calcular ventas y profit global
  const ventasTotal = peds.reduce((sum, p) => sum + (Number(p.total) || 0), 0)
  const costoTotal = peds.reduce((sum, p) => sum + (Number(p.costo_total) || 0), 0)
  const profitTotal = ventasTotal - costoTotal

  // Nuevos tenants esta semana
  const nuevosEstaSemanana = lista.filter(f => new Date(f.created_at) >= new Date(inicioSem)).length

  return {
    tenants: {
      total: lista.length,
      vitalicios: suscs.filter(s => s.estado === 'activo').length,
      restringidos: suscs.filter(s => s.estado === 'suspendido' || s.estado === 'vencido').length,
      nuevos7d: nuevosEstaSemanana,
    },
    ventasTotal,
    profitTotal,
  }
}

export default async function SuperadminPage() {
  const [session, stats] = await Promise.all([
    getSuperadminSession(),
    getStats(),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Bienvenido, {session?.nombre}</p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KPI label="Ventas Globales" value={`S/ ${stats.ventasTotal.toFixed(2)}`} sub="Total histórico" color="green" />
        <KPI label="Profit Global" value={`S/ ${stats.profitTotal.toFixed(2)}`} sub="Ganancia neta" color="blue" />
        <KPI label="Tenants Vitalicios" value={String(stats.tenants.vitalicios)} sub="Activos" color="green" />
        <KPI label="Nuevos (7d)" value={String(stats.tenants.nuevos7d)} sub="Registros recientes" color="yellow" />
      </div>

      {/* Links rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickLink href="/superadmin/tenants" title="Clientes / Suscripciones"
          desc="Gestionar estado vitalicio/pro y ver ventas por cliente" />
        <QuickLink href="/superadmin/historial" title="Historial de Pagos"
          desc="Ver registro de pagos y cambios de suscripción" />
      </div>
    </div>
  )
}

function KPI({ label, value, sub, color }: {
  label: string
  value: string
  sub: React.ReactNode
  color: string
}) {
  const colors: Record<string, string> = {
    green:  'text-green-400',
    yellow: 'text-yellow-400',
    red:    'text-red-400',
    blue:   'text-indigo-400',
    indigo: 'text-purple-400',
    gray:   'text-gray-400',
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colors[color] ?? 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  )
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href}
      className="block bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-600 hover:bg-gray-800/50 transition-colors group">
      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors text-sm">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </Link>
  )
}
