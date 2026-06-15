// Dashboard principal — reestructuración completa
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import PeriodSelector from '@/components/dashboard/PeriodSelector'
import DashboardRealtime from '@/components/dashboard/v2/DashboardRealtime'
import DashboardTitular from '@/components/dashboard/v2/DashboardTitular'
import DashboardAtencion from '@/components/dashboard/v2/DashboardAtencion'
import DashboardKPIs from '@/components/dashboard/v2/DashboardKPIs'
import DashboardCharts from '@/components/dashboard/v2/DashboardCharts'
import DashboardPipeline from '@/components/dashboard/v2/DashboardPipeline'
import DashboardFeed from '@/components/dashboard/v2/DashboardFeed'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>
}) {
  const { p: periodo = 'hoy' } = await searchParams
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const esDueno = session.rol !== 'vendedor'

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">

      {/* Motor realtime — invisible, solo mantiene el websocket */}
      <DashboardRealtime ferreteriaId={session.ferreteriaId} />

      {/* ── CABECERA ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {session.nombreFerreteria}
          </h1>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
            Panel de gestión · {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Suspense fallback={<div className="h-9 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />}>
          <PeriodSelector />
        </Suspense>
      </div>

      {/* ── 1. TITULAR DEL DÍA — dinero + operación lado a lado ───────────── */}
      <DashboardTitular esDueno={esDueno} />

      {/* ── 2. NECESITA TU ATENCIÓN — alertas accionables priorizadas ──────── */}
      <DashboardAtencion />

      {/* ── 3. NÚMEROS CLAVE — KPIs con tendencias, agrupados por tema ──────── */}
      <DashboardKPIs esDueno={esDueno} periodo={periodo} />

      {/* ── 4. GRÁFICOS PROTAGONISTAS — tendencia + top productos ────────────── */}
      <DashboardCharts />

      {/* ── 5. FLUJO DE PEDIDOS + FEED EN VIVO ────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">En tiempo real</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashboardPipeline />
          <DashboardFeed />
        </div>
      </div>

    </div>
  )
}
