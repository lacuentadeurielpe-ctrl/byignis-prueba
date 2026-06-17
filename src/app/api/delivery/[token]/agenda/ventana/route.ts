/**
 * POST /api/delivery/[token]/agenda/ventana
 * El repartidor confirma o ajusta la ventana de una entrega desde su portal.
 * Tras el cambio, re-encadena los bloques posteriores no confirmados.
 *
 * body: { entregaId, accion: 'confirmar' | 'ajustar', inicio?, fin? }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { confirmarVentana, ajustarVentana } from '@/lib/delivery/agenda/repository'
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
  const entregaId = body.entregaId as string | undefined
  const accion = body.accion as 'confirmar' | 'ajustar' | undefined

  if (!entregaId || !accion) {
    return NextResponse.json({ error: 'entregaId y accion son requeridos' }, { status: 400 })
  }

  // La entrega debe pertenecer a la ferretería del repartidor
  const { data: entrega } = await supabase
    .from('entregas')
    .select('id, vehiculo_id')
    .eq('id', entregaId)
    .eq('ferreteria_id', repartidor.ferreteria_id)
    .maybeSingle()

  if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })

  if (accion === 'confirmar') {
    await confirmarVentana(supabase, repartidor.ferreteria_id, entregaId)
  } else {
    const inicio = body.inicio ? new Date(body.inicio) : null
    const fin = body.fin ? new Date(body.fin) : null
    if (!inicio || !fin || isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin <= inicio) {
      return NextResponse.json({ error: 'inicio/fin inválidos' }, { status: 400 })
    }
    await ajustarVentana(supabase, repartidor.ferreteria_id, entregaId, inicio, fin)
  }

  // Re-encadenar la agenda del vehículo (los anclados quedan fijos)
  const vehiculoId = (entrega.vehiculo_id as string | null) ?? (repartidor.vehiculo_actual_id as string | null)
  if (vehiculoId) {
    await recomputarAgendaVehiculo(supabase, repartidor.ferreteria_id, vehiculoId)
  }

  return NextResponse.json({ ok: true })
}
