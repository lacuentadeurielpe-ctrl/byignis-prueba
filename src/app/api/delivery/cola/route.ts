/**
 * GET /api/delivery/cola
 *
 * Retorna pedidos delivery en estado confirmado/en_preparacion sin repartidor asignado.
 * Incluye información de ETA Intelligence para mostrar impacto del tiempo de espera.
 * También incluye lista de repartidores disponibles para asignación rápida.
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  // ── Pedidos en cola (sin repartidor asignado) ────────────────────────────
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero_pedido, nombre_cliente, telefono_cliente,
      direccion_entrega, cliente_lat, cliente_lng, total, estado, eta_minutos,
      created_at, zona_delivery_id, notas,
      zonas_delivery(id, nombre, tiempo_estimado_min),
      items_pedido(id, nombre_producto, cantidad, precio_unitario),
      entregas!left(id, repartidor_id, estado, eta_actual, duracion_estimada_min)
    `)
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('modalidad', 'delivery')
    .in('estado', ['confirmado', 'en_preparacion', 'listo_para_recojo'])
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtrar: solo los que no tienen repartidor asignado en ninguna entrega activa
  const sinAsignar = (pedidos ?? []).filter((p) => {
    const entregasActivas = (p.entregas as any[] ?? []).filter(
      (e) => !['entregado', 'fallida'].includes(e.estado)
    )
    return entregasActivas.every((e) => !e.repartidor_id)
  })

  // Enriquecer con predicciones IA para mostrar confidence
  const pedidoIds = sinAsignar.map((p) => p.id)
  let predMap: Record<string, { confidence: number; source: string; distancia_km: number }> = {}

  if (pedidoIds.length > 0) {
    const { data: preds } = await supabase
      .from('delivery_predictions')
      .select('pedido_id, confidence, eta_source, distancia_km')
      .in('pedido_id', pedidoIds)

    predMap = Object.fromEntries(
      (preds ?? []).map((p) => [p.pedido_id, {
        confidence: p.confidence,
        source: p.eta_source,
        distancia_km: p.distancia_km,
      }])
    )
  }

  // ── Repartidores disponibles (activos, no en ruta actualmente) ────────────
  const { data: todosRepartidores } = await supabase
    .from('repartidores')
    .select('id, nombre, estado_operativo, vehiculos_delivery(id, nombre, tipo, placa)')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('activo', true)

  // Ver cuáles están en ruta ahora mismo
  const { data: enRutaActual } = await supabase
    .from('entregas')
    .select('repartidor_id')
    .eq('ferreteria_id', session.ferreteriaId)
    .in('estado', ['carga', 'en_ruta'])
    .not('repartidor_id', 'is', null)

  const idsEnRuta = new Set((enRutaActual ?? []).map((e: any) => e.repartidor_id))

  const repartidoresDisponibles = (todosRepartidores ?? []).map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    estado: r.estado_operativo,
    enRuta: idsEnRuta.has(r.id),
    vehiculo: r.vehiculos_delivery?.[0] ?? null,
  }))

  // ── Métricas de la cola ───────────────────────────────────────────────────
  const ahora = Date.now()
  const tiemposEspera = sinAsignar.map((p) =>
    Math.round((ahora - new Date(p.created_at).getTime()) / 60_000)
  )
  const maxEspera = tiemposEspera.length > 0 ? Math.max(...tiemposEspera) : 0
  const avgEspera = tiemposEspera.length > 0
    ? Math.round(tiemposEspera.reduce((a, b) => a + b, 0) / tiemposEspera.length)
    : 0

  return NextResponse.json({
    pedidos: sinAsignar.map((p, i) => ({
      ...p,
      minutosEnCola: tiemposEspera[i],
      prediccion: predMap[p.id] ?? null,
    })),
    repartidores: repartidoresDisponibles,
    metricas: {
      total: sinAsignar.length,
      maxEsperaMin: maxEspera,
      avgEsperaMin: avgEspera,
      conAlerta: tiemposEspera.filter((t) => t >= 15).length,
    },
  })
}
