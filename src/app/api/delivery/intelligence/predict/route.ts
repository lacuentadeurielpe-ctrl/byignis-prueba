/**
 * POST /api/delivery/intelligence/predict
 * Calculate intelligent ETA for a delivery
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { calcularETAInteligente, registrarPrediccion } from '@/lib/delivery/intelligence'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const {
    ferreteriaLat, ferreteriaLng,
    clienteLat, clienteLng,
    zonaDeliveryId, vehiculoTipo, velocidadKmh,
    pesoTotalKg, itemsCount, pedidosEnCola,
    entregaId, pedidoId,
  } = body

  if (!ferreteriaLat || !ferreteriaLng || !clienteLat || !clienteLng) {
    return NextResponse.json({ error: 'Coordenadas requeridas' }, { status: 400 })
  }

  const supabase = await createClient()

  const result = await calcularETAInteligente({
    ferreteriaId: session.ferreteriaId,
    ferreteriaLat, ferreteriaLng,
    clienteLat, clienteLng,
    zonaDeliveryId, vehiculoTipo, velocidadKmh,
    pesoTotalKg, itemsCount, pedidosEnCola,
    supabase,
  })

  // If entregaId + pedidoId provided, register the prediction
  let predictionId: string | null = null
  if (entregaId && pedidoId) {
    predictionId = await registrarPrediccion({
      ferreteriaId: session.ferreteriaId,
      entregaId, pedidoId,
      zonaDeliveryId, vehiculoTipo,
      result, itemsCount, pesoTotalKg, pedidosEnCola,
      supabase,
    })
  }

  return NextResponse.json({
    ...result,
    predictionId,
  })
}
