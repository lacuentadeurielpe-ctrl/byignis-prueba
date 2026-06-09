import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { ChatRepository } from '@/lib/db/repositories/chat'
import { inicioDiaLima, finDiaLima } from '@/lib/tiempo'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const chatRepo = new ChatRepository(supabase)

  const fid = session.ferreteriaId
  const inicioHoy = inicioDiaLima(0)
  const inicioAyer = inicioDiaLima(-1)

  try {
    const [
      pedidosHoy,
      pedidosAyer,
      cobrosPendientes,
      convActivas,
      pedidosActivos
    ] = await Promise.all([
      ventasRepo.obtenerPedidosRango(fid, inicioHoy, finDiaLima(0)),
      ventasRepo.obtenerPedidosRango(fid, inicioAyer, inicioHoy),
      ventasRepo.obtenerCobrosPendientesHoy(fid, inicioHoy),
      chatRepo.contarConversacionesPausadas(fid),
      ventasRepo.obtenerPedidosActivosPipeline(fid) // Solo para conteo rápido
    ])

    // Excluimos los mismos estados que dashboard_kpi_rango para que ambas cifras sean consistentes:
    // pendiente (no confirmado), cancelado (nulo), programado (aún no activo)
    const ESTADOS_EXCLUIR_INGRESOS = new Set(['pendiente', 'cancelado', 'programado'])
    const ingresosHoy = (pedidosHoy ?? []).filter((p: any) => !ESTADOS_EXCLUIR_INGRESOS.has(p.estado)).reduce((s, p) => s + (p.total ?? 0), 0)
    const ingresosAyer = (pedidosAyer ?? []).filter((p: any) => !ESTADOS_EXCLUIR_INGRESOS.has(p.estado)).reduce((s, p) => s + (p.total ?? 0), 0)
    
    // Calcular porcentaje de cambio
    let pctCmbHoy = 0
    let subeHoy = true
    if (ingresosAyer === 0) {
      pctCmbHoy = ingresosHoy > 0 ? 100 : 0
      subeHoy = true
    } else {
      const diff = Math.round(((ingresosHoy - ingresosAyer) / ingresosAyer) * 100)
      pctCmbHoy = Math.abs(diff)
      subeHoy = diff >= 0
    }

    const ESTADOS_EN_CURSO = ['pendiente', 'confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado']
    const pipeline: Record<string, number> = {}
    for (const p of pedidosActivos ?? []) pipeline[p.estado] = (pipeline[p.estado] ?? 0) + 1
    const pedidosActivosN = ESTADOS_EN_CURSO.reduce((s, key) => s + (pipeline[key] ?? 0), 0)

    return NextResponse.json({
      ingresosHoy,
      ingresosAyer,
      cmbHoy: { pct: pctCmbHoy, sube: subeHoy },
      pedidosHoyN: (pedidosHoy ?? []).length,
      pedidosActivosN,
      cobrosN: (cobrosPendientes ?? []).length,
      convActivas: convActivas ?? 0
    })
  } catch (err) {
    console.error('Error en /api/dashboard/snapshot:', err)
    return NextResponse.json({ error: 'Error cargando snapshot' }, { status: 500 })
  }
}
