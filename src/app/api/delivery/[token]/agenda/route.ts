/**
 * GET /api/delivery/[token]/agenda
 * Devuelve la agenda del día del vehículo del repartidor: bloques con ventana,
 * su duración de bloque promedio y el promedio real reciente (prometido vs real).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { obtenerAgendaVehiculo, promedioRealReciente } from '@/lib/delivery/agenda/repository'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = adminClient()

  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, ferreteria_id, vehiculo_actual_id, duracion_bloque_default_min')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const vehiculoId = repartidor.vehiculo_actual_id as string | null

  const [bloques, promedio] = await Promise.all([
    vehiculoId ? obtenerAgendaVehiculo(supabase, repartidor.ferreteria_id, vehiculoId) : Promise.resolve([]),
    promedioRealReciente(supabase, repartidor.ferreteria_id, repartidor.id),
  ])

  return NextResponse.json({
    duracionBloqueDefaultMin: repartidor.duracion_bloque_default_min ?? 30,
    promedioRealMin: promedio.promedioMin,
    promedioRealMuestras: promedio.muestras,
    bloques: bloques.map((b) => ({
      entregaId: b.entregaId,
      pedidoId: b.pedidoId,
      numeroPedido: b.numeroPedido,
      estado: b.estado,
      ventanaInicio: b.ventana.inicio.toISOString(),
      ventanaFin: b.ventana.fin.toISOString(),
      origen: b.ventana.origen,
      confirmada: b.ventana.confirmada,
      viajeId: b.viajeId ?? null,
      posicion: b.posicion ?? null,
    })),
  })
}
