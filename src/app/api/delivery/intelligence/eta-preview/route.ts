/**
 * POST /api/delivery/intelligence/eta-preview
 *
 * Calcula un ETA estimado en tiempo real para el formulario de pedidos manuales.
 * Recibe una dirección de texto, la geocodifica y calcula el ETA inteligente.
 *
 * Diseñado para llamadas con debounce desde el frontend (800ms).
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { geocodificarDireccion } from '@/lib/delivery/geocoding'
import { calcularETAInteligente } from '@/lib/delivery/intelligence'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { direccion, zona_delivery_id } = body

  if (!direccion?.trim()) {
    return NextResponse.json({ error: 'Dirección requerida' }, { status: 400 })
  }

  const supabase = await createClient()

  // Obtener coordenadas de la ferretería
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('lat, lng, nombre, direccion')
    .eq('id', session.ferreteriaId)
    .single()

  let ferreteriaLat = ferreteria?.lat as number | null
  let ferreteriaLng = ferreteria?.lng as number | null

  // Si no tiene coords, intentar geocodificar la dirección del negocio
  if (!ferreteriaLat || !ferreteriaLng) {
    const direccionNegocio = (ferreteria?.direccion as string | null) ?? null
    if (direccionNegocio) {
      const coords = await geocodificarDireccion(direccionNegocio, 'Lima, Perú')
      if (coords) {
        ferreteriaLat = coords.lat
        ferreteriaLng = coords.lng
      }
    }
  }

  // Último fallback: centro de Lima
  if (!ferreteriaLat || !ferreteriaLng) {
    ferreteriaLat = -12.0464
    ferreteriaLng = -77.0428
  }

  // Geocodificar dirección del cliente
  const coords = await geocodificarDireccion(
    direccion.trim(),
    (ferreteria?.nombre as string | null) ?? 'Lima',
  )

  if (!coords) {
    return NextResponse.json({ error: 'No se pudo geocodificar la dirección' }, { status: 422 })
  }

  // Contar pedidos en cola (para ajuste por cola)
  const { count: cola } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('modalidad', 'delivery')
    .in('estado', ['confirmado', 'en_preparacion', 'enviado'])

  // Calcular ETA inteligente
  const result = await calcularETAInteligente({
    ferreteriaId: session.ferreteriaId,
    ferreteriaLat: ferreteriaLat,
    ferreteriaLng: ferreteriaLng,
    clienteLat: coords.lat,
    clienteLng: coords.lng,
    zonaDeliveryId: zona_delivery_id ?? null,
    pedidosEnCola: Math.max(0, (cola ?? 0)),
    supabase,
  })

  return NextResponse.json({
    etaMinutos: result.etaMinutos,
    distanciaKm: result.distanciaKm,
    confidence: result.confidence,
    source: result.source,
    coordsCliente: coords,
  })
}
