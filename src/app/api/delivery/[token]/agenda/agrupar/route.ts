/**
 * POST /api/delivery/[token]/agenda/agrupar
 * El repartidor agrupa varias entregas en un mismo viaje ("las latas de arena
 * de camino al cemento"): comparten la ventana del viaje y quedan ancladas.
 *
 * body: { entregaIds: string[] }  // en el orden de las paradas
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { agruparEnViaje } from '@/lib/delivery/agenda/repository'
import { recomputarAgendaVehiculo } from '@/lib/delivery/agenda/acomodar'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = adminClient()

  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, ferreteria_id, vehiculo_actual_id')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const entregaIds = Array.isArray(body.entregaIds) ? (body.entregaIds as string[]) : []
  if (entregaIds.length < 2) {
    return NextResponse.json({ error: 'Se requieren al menos 2 entregas para agrupar' }, { status: 400 })
  }

  // Verificar que todas las entregas son de la ferretería del repartidor
  const { data: entregas } = await supabase
    .from('entregas')
    .select('id, vehiculo_id')
    .eq('ferreteria_id', repartidor.ferreteria_id)
    .in('id', entregaIds)

  if (!entregas || entregas.length !== entregaIds.length) {
    return NextResponse.json({ error: 'Alguna entrega no pertenece a esta ferretería' }, { status: 400 })
  }

  const vehiculoId =
    (entregas[0].vehiculo_id as string | null) ?? (repartidor.vehiculo_actual_id as string | null)

  const { viajeId } = await agruparEnViaje(supabase, {
    ferreteriaId: repartidor.ferreteria_id,
    repartidorId: repartidor.id,
    vehiculoId,
    entregaIds,
  })

  if (!viajeId) {
    return NextResponse.json({ error: 'No se pudo agrupar (faltan ventanas en las entregas)' }, { status: 400 })
  }

  if (vehiculoId) {
    await recomputarAgendaVehiculo(supabase, repartidor.ferreteria_id, vehiculoId)
  }

  return NextResponse.json({ ok: true, viajeId })
}
