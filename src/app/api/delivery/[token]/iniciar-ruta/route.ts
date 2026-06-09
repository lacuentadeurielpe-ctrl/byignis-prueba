/**
 * POST /api/delivery/[token]/iniciar-ruta
 * El portal del repartidor llama este endpoint cuando presiona "Marcar salida".
 * Registra el timestamp de salida (`salio_at`) en la entrega activa.
 * Este timestamp es la referencia del cronómetro — incluso si el browser
 * se suspende, siempre es `Date.now() - new Date(salio_at).getTime()`.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = adminClient()

  // Autenticar repartidor por token
  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, ferreteria_id, estado_operativo')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const ahora = new Date().toISOString()

  // Actualizar la entrega más reciente pendiente / asignada del repartidor
  const { data: entrega, error } = await supabase
    .from('entregas')
    .update({ salio_at: ahora, estado: 'en_ruta' })
    .eq('repartidor_id', repartidor.id)
    .eq('ferreteria_id', repartidor.ferreteria_id)
    .in('estado', ['pendiente', 'asignado', 'en_ruta'])
    .order('created_at', { ascending: false })
    .limit(1)
    .select('id, pedido_id')
    .single()

  if (error || !entrega) {
    // Puede que ya esté en ruta — responder ok igualmente
    return NextResponse.json({ ok: true, salio_at: ahora, mensaje: 'Sin entrega activa para actualizar' })
  }

  // Marcar repartidor en ruta si no lo está
  if (repartidor.estado_operativo !== 'en_ruta') {
    await supabase
      .from('repartidores')
      .update({ estado_operativo: 'en_ruta' })
      .eq('id', repartidor.id)
  }

  return NextResponse.json({
    ok:        true,
    salio_at:  ahora,
    entregaId: entrega.id,
    pedidoId:  entrega.pedido_id,
  })
}
