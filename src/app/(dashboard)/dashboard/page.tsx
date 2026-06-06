// Dashboard principal — Fase 2 REFORMA
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { ChatRepository } from '@/lib/db/repositories/chat'
import { ClientesRepository } from '@/lib/db/repositories/clientes'
import { formatPEN, labelEstadoPedido } from '@/lib/utils'
import {
  ShoppingCart, MessageSquare, TrendingUp, TrendingDown,
  Clock, CheckCircle2, Truck, Package, Banknote,
  FileText, CreditCard, Target, Users, Zap, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import ActivityChart from '@/components/dashboard/ActivityChart'
import PeriodSelector from '@/components/dashboard/PeriodSelector'
import { redirect } from 'next/navigation'
import { inicioDiaLima, finDiaLima, fechaLimaStr, fechaLocalLima, etiquetaFechaLima, ahoraLima } from '@/lib/tiempo'
import DashboardSnapshot from '@/components/dashboard/v2/DashboardSnapshot'
import DashboardKPIs from '@/components/dashboard/v2/DashboardKPIs'
import DashboardPipeline from '@/components/dashboard/v2/DashboardPipeline'
import DashboardFeed from '@/components/dashboard/v2/DashboardFeed'
import DashboardCharts from '@/components/dashboard/v2/DashboardCharts'
import DashboardRealtime from '@/components/dashboard/v2/DashboardRealtime'

export const dynamic = 'force-dynamic'

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function calcPeriodo(p: string): { inicio: string; fin: string; prevInicio: string; prevFin: string; label: string; dias: number } {
  const finHoy = finDiaLima(0)
  switch (p) {
    case 'ayer': {
      const inicio = inicioDiaLima(-1)
      const fin    = inicioDiaLima(0)
      return { inicio, fin, prevInicio: inicioDiaLima(-2), prevFin: inicio, label: 'Ayer', dias: 1 }
    }
    case 'semana': {
      const lima = ahoraLima(); const dow = lima.getUTCDay()
      const diasDesdeL = dow === 0 ? 6 : dow - 1
      const inicio = inicioDiaLima(-diasDesdeL)
      return { inicio, fin: finHoy, prevInicio: inicioDiaLima(-diasDesdeL - 7), prevFin: inicio, label: 'Esta semana', dias: diasDesdeL + 1 }
    }
    case 'mes': {
      const lima = ahoraLima()
      const yyyy = lima.getUTCFullYear(); const mm = String(lima.getUTCMonth() + 1).padStart(2, '0'); const dia = lima.getUTCDate()
      const inicio = `${yyyy}-${mm}-01T05:00:00Z`
      const prevLima = ahoraLima(); prevLima.setUTCMonth(prevLima.getUTCMonth() - 1)
      const pYyyy = prevLima.getUTCFullYear(); const pMm = String(prevLima.getUTCMonth() + 1).padStart(2, '0')
      return { inicio, fin: finHoy, prevInicio: `${pYyyy}-${pMm}-01T05:00:00Z`, prevFin: inicio, label: 'Este mes', dias: dia }
    }
    case '30d': {
      const inicio = inicioDiaLima(-29)
      return { inicio, fin: finHoy, prevInicio: inicioDiaLima(-59), prevFin: inicio, label: 'Últimos 30 días', dias: 30 }
    }
    default: {
      const inicio = inicioDiaLima(0)
      return { inicio, fin: finHoy, prevInicio: inicioDiaLima(-1), prevFin: inicio, label: 'Hoy', dias: 1 }
    }
  }
}

function cambio(actual: number, prev: number): { pct: number; sube: boolean } | null {
  if (prev === 0) return actual > 0 ? { pct: 100, sube: true } : null
  const pct = Math.round(((actual - prev) / prev) * 100)
  return { pct: Math.abs(pct), sube: pct >= 0 }
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

// Estados que cuentan como "activos" (no incluye entregado ni cancelado)
const ESTADOS_EN_CURSO = ['pendiente', 'confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado']

const ESTADOS_PIPELINE = [
  { key: 'pendiente',      label: 'Pendiente',  icon: Clock,        bg: 'bg-amber-50',   dot: 'bg-amber-400',   text: 'text-amber-700'  },
  { key: 'confirmado',     label: 'Confirmado', icon: CheckCircle2, bg: 'bg-sky-50',     dot: 'bg-sky-400',     text: 'text-sky-700'    },
  { key: 'en_preparacion', label: 'Preparando', icon: Package,      bg: 'bg-violet-50',  dot: 'bg-violet-400',  text: 'text-violet-700' },
  { key: 'listo_para_recojo',label: 'Listo Recojo',icon: Package,   bg: 'bg-teal-50',    dot: 'bg-teal-400',    text: 'text-teal-700'   },
  { key: 'enviado',        label: 'En camino',  icon: Truck,        bg: 'bg-blue-50',    dot: 'bg-blue-400',    text: 'text-blue-700'   },
  { key: 'entregado',      label: 'Entregado',  icon: CheckCircle2, bg: 'bg-emerald-50', dot: 'bg-emerald-400', text: 'text-emerald-700'},
]

function colorFeed(estado: string): string {
  const map: Record<string, string> = { entregado: 'bg-emerald-400', enviado: 'bg-blue-400', listo_para_recojo: 'bg-teal-400', en_preparacion: 'bg-violet-400', confirmado: 'bg-sky-400', pendiente: 'bg-amber-400', cancelado: 'bg-red-400' }
  return map[estado] ?? 'bg-zinc-300'
}
function textFeed(estado: string): string {
  const map: Record<string, string> = { entregado: 'Pedido entregado', enviado: 'Pedido en camino', listo_para_recojo: 'Listo para recojo', en_preparacion: 'En preparación', confirmado: 'Pedido confirmado', pendiente: 'Pedido recibido', cancelado: 'Pedido cancelado' }
  return map[estado] ?? labelEstadoPedido(estado)
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p: periodo = 'hoy' } = await searchParams
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const esDueno = session.rol !== 'vendedor'

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* ── MOTOR REALTIME ────────────────────────────────────────────── */}
      <DashboardRealtime ferreteriaId={session.ferreteriaId} />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">{session.nombreFerreteria}</h1>
          <p className="text-zinc-400 text-sm mt-0.5 capitalize">{etiquetaFechaLima()}</p>
        </div>
        <Suspense>
          <PeriodSelector />
        </Suspense>
      </div>

      {/* ── COMPONENTES CLIENTE (SWR + REALTIME) ──────────────────────── */}
      <DashboardSnapshot esDueno={esDueno} />
      
      <DashboardKPIs esDueno={esDueno} periodo={periodo} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardPipeline />
        <DashboardFeed />
      </div>

      <DashboardCharts />
    </div>
  )
}


