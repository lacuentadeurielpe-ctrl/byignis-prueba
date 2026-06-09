/**
 * POST /api/delivery/[token]/eta-desde-gps
 * El portal del repartidor envía su posición GPS actual y recibe
 * ETAs calculados via OSRM /route para cada parada pendiente.
 *
 * Body: { lat: number, lng: number }
 *
 * Responde: { paradas: Array<{ pedidoId, etaMinutos, distanciaKm }> }
 *
 * Se llama cada ~60 s desde el portal para actualizar los badges de ETA en tiempo real.
 * OSRM es gratuito y sin límite de tasa, así que es aceptable.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcularRuta } from '@/lib/delivery/osrm'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = adminClient()

  // Autenticar repartidor
  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, ferreteria_id')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await req.json() as { lat: number; lng: number }

  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'lat y lng requeridos' }, { status: 400 })
  }

  // Obtener paradas activas (pedidos en ruta o asignados)
  const { data: entregas } = await supabase
    .from('entregas')
    .select('id, pedido_id, cliente_lat, cliente_lng, pedidos(numero_pedido, nombre_cliente)')
    .eq('repartidor_id', repartidor.id)
    .eq('ferreteria_id', repartidor.ferreteria_id)
    .in('estado', ['pendiente', 'asignado', 'en_ruta'])
    .order('posicion_ruta', { ascending: true })

  if (!entregas?.length) {
    return NextResponse.json({ paradas: [] })
  }

  // Calcular ETA por OSRM para cada parada
  const paradas: Array<{
    entregaId:    string
    pedidoId:     string
    numeroPedido: string
    etaMinutos:   number
    distanciaKm:  number
  }> = []

  for (const entrega of entregas) {
    const destLat = entrega.cliente_lat as number | null
    const destLng = entrega.cliente_lng as number | null

    if (!destLat || !destLng) continue

    try {
      const ruta = await calcularRuta(
        { lat: body.lat, lng: body.lng },
        { lat: destLat,  lng: destLng  }
      )

      paradas.push({
        entregaId:    entrega.id as string,
        pedidoId:     entrega.pedido_id as string,
        numeroPedido: (entrega.pedidos as any)?.numero_pedido ?? '',
        etaMinutos:   ruta.duracionMin,
        distanciaKm:  ruta.distanciaKm,
      })
    } catch (err) {
      // calcularRuta tiene haversine fallback interno — este catch es defensa extra
      console.error('[eta-desde-gps] Error calculando ruta:', err)
    }
  }

  // Actualizar última posición del repartidor (fire-and-forget)
  supabase
    .from('repartidores')
    .update({ ultima_lat: body.lat, ultima_lng: body.lng, gps_actualizado_at: new Date().toISOString() })
    .eq('id', repartidor.id)
    .then()

  return NextResponse.json({ paradas })
}
