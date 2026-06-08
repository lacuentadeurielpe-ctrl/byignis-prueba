/**
 * POST /api/delivery/incidencias/[pedidoId]/resolver
 *
 * El dueño resuelve una incidencia. Acciones posibles:
 *   - resolver:   limpia la incidencia y deja el pedido como estaba
 *   - reasignar:  limpia la incidencia y asigna a otro repartidor
 *   - cancelar:   cancela el pedido y dispara recalculo de cola (Inngest)
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { pedidoId } = await params
  const body = await request.json()
  const { accion, nuevo_repartidor_id, notas_resolucion } = body

  const ACCIONES_VALIDAS = ['resolver', 'reasignar', 'cancelar']
  if (!ACCIONES_VALIDAS.includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  // Verificar que el pedido pertenece a esta ferretería
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, incidencia_tipo')
    .eq('id', pedidoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const update: Record<string, unknown> = {
    incidencia_tipo: null,
    incidencia_desc: null,
  }

  if (accion === 'resolver') {
    // Solo limpiar la incidencia, mantener estado actual
    if (notas_resolucion) {
      update.notas = notas_resolucion
    }
  }

  if (accion === 'reasignar') {
    if (!nuevo_repartidor_id) {
      return NextResponse.json({ error: 'nuevo_repartidor_id requerido para reasignar' }, { status: 400 })
    }
    update.repartidor_id = nuevo_repartidor_id
    update.estado = 'confirmado' // Volver a confirmado para nuevo ciclo

    // Actualizar también la entrega
    const { data: entrega } = await supabase
      .from('entregas')
      .select('id')
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle()

    if (entrega) {
      await supabaseAdmin
        .from('entregas')
        .update({
          repartidor_id: nuevo_repartidor_id,
          estado: 'asignado',
          salio_at: null,
        })
        .eq('id', entrega.id)
    }
  }

  if (accion === 'cancelar') {
    update.estado = 'cancelado'

    // Liberar la entrega
    await supabaseAdmin
      .from('entregas')
      .update({ estado: 'fallida' })
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', session.ferreteriaId)

    // Disparar recalculo de cola (liberó un slot)
    try {
      await inngest.send({
        name: 'delivery/cola.changed',
        data: {
          ferreteriaId: session.ferreteriaId,
          motivo: 'cancelado',
          pedidoId,
        },
      })
    } catch (e) {
      console.error('[Incidencias/Resolver] Error enviando evento Inngest:', e)
    }
  }

  const { error } = await supabaseAdmin
    .from('pedidos')
    .update(update)
    .eq('id', pedidoId)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    accion,
    pedidoId,
    numeroPedido: pedido.numero_pedido,
  })
}
