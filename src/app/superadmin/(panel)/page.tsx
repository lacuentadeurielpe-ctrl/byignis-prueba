// /superadmin — Dashboard con métricas globales de la plataforma

import Link from 'next/link'
import { getSuperadminSession } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { inicioDiaLima } from '@/lib/tiempo'

export const dynamic = 'force-dynamic'

const TIPO_CAMBIO = 3.75

async function getStats() {
  const admin      = createAdminClient()
  const inicio30d  = inicioDiaLima(-30)
  const inicioMes  = inicioDiaLima(-30)
  const inicioSem  = inicioDiaLima(-7)

  const [
    { data: ferreterias },
    { data: suscripciones },
    { data: planes },
    { data: movsHoy },
    { data: movsMes },
    { data: movsMesAnt },
    { data: incidencias },
  ] = await Promise.all([
    admin.from('ferreterias').select('id, nombre, estado_tenant, created_at'),
    admin.from('suscripciones').select('ferreteria_id, plan_id, estado, creditos_disponibles, creditos_mes'),
    admin.from('planes').select('id, nombre, precio_mensual, creditos_mes'),
    admin.from('movimientos_creditos').select('creditos_usados, costo_usd').gte('created_at', inicioDiaLima(0)),
    admin.from('movimientos_creditos').select('ferreteria_id, costo_usd, created_at').gte('created_at', inicioMes),
    admin.from('movimientos_creditos').select('costo_usd').gte('created_at', inicioDiaLima(-60)).lt('created_at', inicioMes),
    admin.from('incidencias_sistema').select('id, tipo').eq('resuelto', false),
  ])

  const lista       = ferreterias ?? []
  const suscs       = suscripciones ?? []
  const planesMap   = Object.fromEntries((planes ?? []).map(p => [p.id, p]))

  // MRR: suma precios de suscripciones activas
  const mrrPen = suscs
    .filter(s => s.estado === 'activo' && s.plan_id && planesMap[s.plan_id])
    .reduce((sum, s) => sum + Number(planesMap[s.plan_id]?.precio_mensual ?? 0), 0)
  const mrrUsd = mrrPen / TIPO_CAMBIO

  // Costo IA mes actual vs mes anterior
  const costoMesUsd    = (movsMes ?? []).reduce((s, m) => s + Number(m.costo_usd ?? 0), 0)
  const costoMesAntUsd = (movsMesAnt ?? []).reduce((s, m) => s + Number(m.costo_usd ?? 0), 0)
  const margenUsd      = mrrUsd - costoMesUsd
  const margenPct      = mrrUsd > 0 ? Math.round((margenUsd / mrrUsd) * 100) : 0

  // Tenants en riesgo: créditos disponibles < 20% del plan
  const tenantEnRiesgo = suscs.filter(s => {
    const plan = planesMap[s.plan_id ?? '']
    if (!plan || !s.creditos_mes) return false
    const pct = (s.creditos_disponibles ?? 0) / s.creditos_mes
    return pct < 0.20 && s.estado === 'activo'
  })
  const idsEnRiesgo = new Set(tenantEnRiesgo.map(s => s.ferreteria_id))

  // Tenants sin actividad 7 días
  const conActividadSem = new Set((movsMes ?? [])
    .filter(m => new Date(m.created_at) >= new Date(inicioSem))
    .map(m => m.ferreteria_id))
  const suscsActivas   = suscs.filter(s => s.estado === 'activo')
  const sinActividad7d = suscsActivas.filter(s => !conActividadSem.has(s.ferreteria_id)).length

  // Nuevos tenants esta semana
  const nuevosEstaSemanana = lista.filter(f => new Date(f.created_at) >= new Date(inicioSem)).length

  return {
    tenants: {
      total:       lista.length,
      activos:     lista.filter(f => f.estado_tenant === 'activo').length,
      trial:       lista.filter(f => f.estado_tenant === 'trial').length,
      suspendidos: lista.filter(f => f.estado_tenant === 'suspendido').length,
      nuevos7d:    nuevosEstaSemanana,
    },
    mrr: { pen: mrrPen, usd: mrrUsd },
    ia: {
      costoMesUsd,
      costoMesAntUsd,
      varPct: costoMesAntUsd > 0 ? Math.round(((costoMesUsd - costoMesAntUsd) / costoMesAntUsd) * 100) : 0,
      creditosHoy: (movsHoy ?? []).reduce((s, m) => s + (m.creditos_usados ?? 0), 0),
      costoHoyUsd: (movsHoy ?? []).reduce((s, m) => s + Number(m.costo_usd ?? 0), 0),
    },
    margen: { usd: margenUsd, pct: margenPct },
    riesgo: { count: idsEnRiesgo.size, tenants: [...idsEnRiesgo] },
    sinActividad7d,
    incidencias_abiertas: (incidencias ?? []).length,
    nombresTenantRiesgo: lista
      .filter(f => idsEnRiesgo.has(f.id))
      .map(f => f.nombre)
      .slice(0, 3),
  }
}

export default async function SuperadminPage() {
  const [session, stats] = await Promise.all([
    getSuperadminSession(),
    getStats(),
  ])

  const varColor = stats.ia.varPct > 0 ? 'text-red-400' : 'text-green-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Bienvenido, {session?.nombre}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/superadmin/billing"
            className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
            Registrar pago
          </Link>
          <Link href="/superadmin/config"
            className="px-3 py-1.5 text-xs border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
            Config global
          </Link>
        </div>
      </div>

      {/* Alerta: tenants en riesgo */}
      {stats.riesgo.count > 0 && (
        <div className="mb-5 bg-red-950/30 border border-red-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-400">
              {stats.riesgo.count} tenant{stats.riesgo.count > 1 ? 's' : ''} con créditos &lt; 20%
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              {stats.nombresTenantRiesgo.join(' · ')}{stats.riesgo.count > 3 ? ` +${stats.riesgo.count - 3} más` : ''}
            </p>
          </div>
          <Link href="/superadmin/tenants?filtro=riesgo"
            className="shrink-0 px-3 py-1.5 text-xs bg-red-800 hover:bg-red-700 text-white rounded-lg transition-colors">
            Ver tenants →
          </Link>
        </div>
      )}

      {/* Alerta: incidencias */}
      {stats.incidencias_abiertas > 0 && (
        <div className="mb-5 bg-yellow-950/30 border border-yellow-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-yellow-400 font-semibold">
            {stats.incidencias_abiertas} incidencia{stats.incidencias_abiertas > 1 ? 's' : ''} sin resolver
          </p>
          <Link href="/superadmin/salud"
            className="shrink-0 px-3 py-1.5 text-xs bg-yellow-800 hover:bg-yellow-700 text-white rounded-lg transition-colors">
            Ver salud →
          </Link>
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KPI label="MRR" value={`S/ ${stats.mrr.pen.toFixed(2)}`} sub={`$${stats.mrr.usd.toFixed(2)} USD`} color="green" />
        <KPI label="Costo IA / mes" value={`$${stats.ia.costoMesUsd.toFixed(2)}`}
          sub={<span className={varColor}>{stats.ia.varPct > 0 ? '+' : ''}{stats.ia.varPct}% vs mes ant.</span>}
          color="red" />
        <KPI label="Margen bruto" value={`${stats.margen.pct}%`}
          sub={`$${stats.margen.usd.toFixed(2)} USD`}
          color={stats.margen.pct >= 80 ? 'green' : stats.margen.pct >= 50 ? 'yellow' : 'red'} />
        <KPI label="Tenants activos" value={String(stats.tenants.activos)}
          sub={`${stats.tenants.trial} trial · ${stats.tenants.suspendidos} suspendidos`}
          color="blue" />
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Créditos IA hoy" value={stats.ia.creditosHoy.toLocaleString()}
          sub={`$${stats.ia.costoHoyUsd.toFixed(4)} USD`} color="indigo" />
        <KPI label="Sin actividad 7d" value={String(stats.sinActividad7d)}
          sub="tenants activos" color={stats.sinActividad7d > 0 ? 'yellow' : 'gray'} />
        <KPI label="Nuevos esta semana" value={String(stats.tenants.nuevos7d)}
          sub="registros" color="blue" />
        <KPI label="Total ferreterías" value={String(stats.tenants.total)}
          sub="en la plataforma" color="gray" />
      </div>

      {/* Links rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickLink href="/superadmin/tenants" title="Tenants"
          desc="Gestionar, suspender, cambiar plan" />
        <QuickLink href="/superadmin/planes" title="Planes & Funciones"
          desc="Precios, créditos, matrix de funciones" />
        <QuickLink href="/superadmin/ia" title="Economía IA"
          desc="Tarifas de APIs, consumo, facturas internas" />
        <QuickLink href="/superadmin/seguridad" title="Auditoría"
          desc="Log de acciones del superadmin" />
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
