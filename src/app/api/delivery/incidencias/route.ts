/**
 * GET /api/delivery/incidencias
 *
 * Retorna todos los pedidos con incidencias activas reportadas por repartidores.
 * Incluye información del repartidor, tipo de incidencia, tiempo desde el reporte,
 * y el ETA original para calcular el impacto del problema.
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  const { data: incidencias, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero_pedido, nombre_cliente, telefono_cliente,
      direccion_entrega, total, estado, estado_pago,
      incidencia_tipo, incidencia_desc,
      eta_minutos, created_at,
      repartidor_id,
      zonas_delivery(id, nombre),
      items_pedido(id, nombre_producto, cantidad),
      entregas!left(
        id, estado, repartidor_id, salio_at, eta_actual,
        repartidores(id, nombre)
      )
    `)
    .eq('ferreteria_id', session.ferreteriaId)
    .not('incidencia_tipo', 'is', null)
    .not('estado', 'in', '("entregado","cancelado","devuelto")')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enriquecer con tiempo desde la incidencia
  const ahora = Date.now()
  const enriched = (incidencias ?? []).map((p) => {
    const entrega = (p.entregas as any[])?.[0]
    const minutosDesdeCreacion = Math.round(
      (ahora - new Date(p.created_at).getTime()) / 60_000
    )
    // Calcular si el ETA ya se pasó
    const etaYaSurio = p.eta_minutos
      ? minutosDesdeCreacion > (p.eta_minutos + 15)
      : false

    return {
      ...p,
      minutosDesdeCreacion,
      etaYaSurio,
      repartidorNombre: entrega?.repartidores?.nombre ?? null,
      entregaEstado: entrega?.estado ?? null,
      entregaId: entrega?.id ?? null,
    }
  })

  // Agrupar por urgencia
  const urgentes = enriched.filter((p) => p.etaYaSurio || p.minutosDesdeCreacion > 30)
  const normales = enriched.filter((p) => !p.etaYaSurio && p.minutosDesdeCreacion <= 30)

  return NextResponse.json({
    incidencias: enriched,
    urgentes: urgentes.length,
    normales: normales.length,
    total: enriched.length,
  })
}
