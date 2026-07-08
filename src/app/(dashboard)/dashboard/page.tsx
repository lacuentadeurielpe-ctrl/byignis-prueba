import { getSessionInfo } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import PeriodSelector from '@/components/dashboard/PeriodSelector'
import DashboardRealtime from '@/components/dashboard/v2/DashboardRealtime'
import DashboardHero from '@/components/dashboard/v2/DashboardHero'
import DashboardAtencion from '@/components/dashboard/v2/DashboardAtencion'
import DashboardPipeline from '@/components/dashboard/v2/DashboardPipeline'
import DashboardFeed from '@/components/dashboard/v2/DashboardFeed'
import SucursalSelector from '@/components/dashboard/SucursalSelector'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; s?: string }>
}) {
  const { p: periodo = 'semana', s: sucursalId } = await searchParams
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const esDueno = session.rol !== 'vendedor'

  const supabase = await createClient()
  let locales: any[] = []
  if (session.multiSucursal) {
    const { data } = await supabase.from('locales_ferreteria').select('id, nombre').eq('ferreteria_id', session.ferreteriaId).eq('activo', true)
    locales = data ?? []
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">

      {/* Motor realtime — invisible */}
      <DashboardRealtime ferreteriaId={session.ferreteriaId} />

      {/* ── CABECERA ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {session.nombreFerreteria}
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session.multiSucursal && (
            <Suspense fallback={<div className="h-9 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />}>
              <SucursalSelector locales={locales} />
            </Suspense>
          )}
          <Suspense fallback={<div className="h-9 w-44 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />}>
            <PeriodSelector />
          </Suspense>
        </div>
      </div>

      {/* ── 1. HERO — ingresos + gráfico 30d + stats strip ─────── */}
      <DashboardHero esDueno={esDueno} periodo={periodo} sucursalId={sucursalId} />

      {/* ── 2. NECESITA ATENCIÓN ─────────────────────────────────── */}
      <DashboardAtencion />

      {/* ── 3. PIPELINE + FEED ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardPipeline />
        <DashboardFeed />
      </div>

    </div>
  )
}
