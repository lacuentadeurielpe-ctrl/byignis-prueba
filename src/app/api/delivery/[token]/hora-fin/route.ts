/**
 * POST /api/delivery/[token]/hora-fin
 * El repartidor declara la hora estimada de finalización para una entrega.
 * Se guarda en entregas.hora_fin_declarada y se espeja en pedidos.eta_timestamp.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { declararHoraFin } from '@/lib/delivery/eta-simple'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = adminClient()

  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, ferreteria_id')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await request.json()
  const { entregaId, pedidoId, horaFin } = body as {
    entregaId: string
    pedidoId: string
    horaFin: string  // ISO string
  }

  if (!entregaId || !pedidoId || !horaFin) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const horaFinDate = new Date(horaFin)
  if (isNaN(horaFinDate.getTime())) {
    return NextResponse.json({ error: 'horaFin inválida' }, { status: 400 })
  }

  // Verificar que la entrega pertenece a esta ferretería (TENANT AISLADO)
  const { data: entrega } = await supabase
    .from('entregas')
    .select('id')
    .eq('id', entregaId)
    .eq('ferreteria_id', repartidor.ferreteria_id)
    .maybeSingle()

  if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })

  await declararHoraFin(supabase, entregaId, pedidoId, repartidor.ferreteria_id, horaFinDate)

  return NextResponse.json({ ok: true, horaFin: horaFinDate.toISOString() })
}
