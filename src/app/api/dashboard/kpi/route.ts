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

function cambio(actual: number, prev: number): { pct: number; sube: boolean } | null {
  if (prev === 0) return actual > 0 ? { pct: 100, sube: true } : null
  const pct = Math.round(((actual - prev) / prev) * 100)
  return { pct: Math.abs(pct), sube: pct >= 0 }
}

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const p = searchParams.get('p') || 'hoy'
  const per = calcPeriodo(p)
  
  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const chatRepo = new ChatRepository(supabase)
  const clientesRepo = new ClientesRepository(supabase)

  const fid = session.ferreteriaId

  try {
    const [
      pedidosPer,
      pedidosPrevPer,
      convPer,
      convPrevPer,
      clientesNuevosPer,
      clientesPrevPer,
      convActivas
    ] = await Promise.all([
      ventasRepo.obtenerPedidosRango(fid, per.inicio, per.fin),
      ventasRepo.obtenerPedidosRango(fid, per.prevInicio, per.prevFin),
      chatRepo.contarConversacionesActivasRango(fid, per.inicio, per.fin),
      chatRepo.contarConversacionesActivasRango(fid, per.prevInicio, per.prevFin),
      clientesRepo.contarClientesNuevosRango(fid, per.inicio, per.fin),
      clientesRepo.contarClientesNuevosRango(fid, per.prevInicio, per.prevFin),
      chatRepo.contarConversacionesPausadas(fid),
    ])

    const pedidosPerArr   = pedidosPer ?? []
    const pedidosPrevArr  = pedidosPrevPer ?? []
    const totalPerPedidos = pedidosPerArr.length
    const prevPerPedidos  = pedidosPrevArr.length
    const perEntregados   = pedidosPerArr.filter((p: any) => p.estado === 'entregado').length
    const prevEntregados  = pedidosPrevArr.filter((p: any) => p.estado === 'entregado').length
    const perIngresos     = pedidosPerArr.filter((p: any) => p.estado !== 'cancelado').reduce((s, p) => s + (p.total ?? 0), 0)
    const prevPerIngresos = pedidosPrevArr.filter((p: any) => p.estado !== 'cancelado').reduce((s, p) => s + (p.total ?? 0), 0)
    const perGanancia     = session.rol !== 'vendedor' ? pedidosPerArr.filter((p: any) => p.estado === 'entregado').reduce((s, p) => s + (p.total ?? 0) - (p.costo_total ?? 0), 0) : 0
    const ticketProm      = totalPerPedidos > 0 ? Math.round(perIngresos / totalPerPedidos) : 0
    const prevTicket      = prevPerPedidos  > 0 ? Math.round(prevPerIngresos / prevPerPedidos) : 0
    const tasaEntrega     = totalPerPedidos > 0 ? Math.round((perEntregados / totalPerPedidos) * 100) : 0
    const prevTasaEntrega = prevPerPedidos  > 0 ? Math.round((prevEntregados / prevPerPedidos) * 100) : 0

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
      cambios: {
        pedidos: cambio(totalPerPedidos, prevPerPedidos),
        ingresos: cambio(perIngresos, prevPerIngresos),
        ticket: cambio(ticketProm, prevTicket),
        tasa: cambio(tasaEntrega, prevTasaEntrega),
        clientes: cambio(clientesNuevosPer ?? 0, clientesPrevPer ?? 0),
        conv: cambio(convPer ?? 0, convPrevPer ?? 0)
      }
    })
  } catch (err) {
    console.error('Error en /api/dashboard/kpi:', err)
    return NextResponse.json({ error: 'Error cargando KPIs' }, { status: 500 })
  }
}
