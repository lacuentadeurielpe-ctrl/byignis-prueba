import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { ChatRepository } from '@/lib/db/repositories/chat'
import { ClientesRepository } from '@/lib/db/repositories/clientes'
import { inicioDiaLima, finDiaLima, ahoraLima } from '@/lib/tiempo'

export const dynamic = 'force-dynamic'

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

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const p = searchParams.get('p') || 'semana'
  const per = calcPeriodo(p)

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const chatRepo = new ChatRepository(supabase)
  const clientesRepo = new ClientesRepository(supabase)

  const fid = session.ferreteriaId

  try {
    const [
      kpiPer,
      convPer,
      clientesNuevosPer,
      convActivas
    ] = await Promise.all([
      ventasRepo.obtenerKPIsRango(fid, per.inicio, per.fin),
      chatRepo.contarConversacionesActivasRango(fid, per.inicio, per.fin),
      clientesRepo.contarClientesNuevosRango(fid, per.inicio, per.fin),
      chatRepo.contarConversacionesPausadas(fid),
    ])

    const totalPerPedidos = Number(kpiPer.pedidos_n)
    const perEntregados   = Number(kpiPer.entregados_n)
    const perIngresos     = Number(kpiPer.ingresos_total)
    const perGanancia     = session.rol !== 'vendedor' ? Number(kpiPer.ganancia_total) : 0
    const ticketProm      = perEntregados > 0 ? Math.round(perIngresos / perEntregados) : 0
    const tasaEntrega     = totalPerPedidos > 0 ? Math.round((perEntregados / totalPerPedidos) * 100) : 0

    return NextResponse.json({
      periodoLabel: per.label,
      totalPerPedidos,
      perEntregados,
      perIngresos,
      perGanancia,
      ticketProm,
      tasaEntrega,
      clientesNuevosPer: clientesNuevosPer ?? 0,
      convPer: convPer ?? 0,
      convActivas: convActivas ?? 0,
    })
  } catch (err) {
    console.error('Error en /api/dashboard/kpi:', err)
    return NextResponse.json({ error: 'Error cargando KPIs' }, { status: 500 })
  }
}
