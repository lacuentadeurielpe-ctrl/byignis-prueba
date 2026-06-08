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

  // Obtener datos de la ferretería
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('nombre')
    .eq('id', session.ferreteriaId)
    .single()

  // Prioridad 1: coordenadas del local principal (locales_ferreteria)
  const { data: localPrincipal } = await supabase
    .from('locales_ferreteria')
    .select('lat, lng, direccion')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('es_principal', true)
    .eq('activo', true)
    .single()

  let ferreteriaLat = (localPrincipal?.lat ?? null) as number | null
  let ferreteriaLng = (localPrincipal?.lng ?? null) as number | null

  // Prioridad 2: geocodificar dirección del local principal si no tiene coords
  if (!ferreteriaLat || !ferreteriaLng) {
    const dirLocal = (localPrincipal?.direccion as string | null) ?? null
    if (dirLocal && dirLocal !== 'Por definir') {
      const coords = await geocodificarDireccion(dirLocal, 'Perú')
      if (coords) {
        ferreteriaLat = coords.lat
        ferreteriaLng = coords.lng
      }
    }
  }

  // Prioridad 3: cualquier local activo con coords
  if (!ferreteriaLat || !ferreteriaLng) {
    const { data: otroLocal } = await supabase
      .from('locales_ferreteria')
      .select('lat, lng')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('activo', true)
      .not('lat', 'is', null)
      .limit(1)
      .single()
    if (otroLocal?.lat) {
      ferreteriaLat = otroLocal.lat as number
      ferreteriaLng = otroLocal.lng as number
    }
  }

  // Último fallback: centro de Lima
  if (!ferreteriaLat || !ferreteriaLng) {
    ferreteriaLat = -12.0464
    ferreteriaLng = -77.0428
  }

  // Geocodificar dirección del cliente
  // Pasamos las coords del local como bias: Google priorizará resultados
  // cerca de la ferretería (ideal para direcciones coloquiales locales).
  // Si la dirección es de otra región, Google igual la encuentra.
  const coords = await geocodificarDireccion(
    direccion.trim(),
    (ferreteria?.nombre as string | null) ?? 'Perú',
    ferreteriaLat && ferreteriaLng
      ? { lat: ferreteriaLat, lng: ferreteriaLng, radiusKm: 80 }
      : undefined,
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
    coordsCliente: { lat: coords.lat, lng: coords.lng },
    direccionResuelta: coords.direccionResuelta ?? null,
  })
}
