/**
 * POST /api/delivery/reassign
 * Reasigna una o varias entregas a un repartidor específico o automáticamente.
 *
 * Body (opción A — manual):
 *   { pedido_id, repartidor_id }
 *
 * Body (opción B — automático):
 *   { entrega_ids: string[], auto?: boolean, motivo?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { reasignarEntregas, type MotivoReasignacion } from '@/lib/delivery/reassignment-engine'
import { recalcularETAsCascada } from '@/lib/delivery/cascade-eta'

export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as {
    pedido_id?:     string
    entrega_ids?:   string[]
    repartidor_id?: string
    auto?:          boolean
    motivo?:        string
  }

  const supabase = await createClient()

  // ── A) Asignación manual a repartidor específico ─────────────────────────
  if (body.pedido_id && body.repartidor_id) {
    const { data: entrega } = await supabase
      .from('entregas')
      .select('id, estado')
      .eq('pedido_id', body.pedido_id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })

    const { error } = await supabase
      .from('entregas')
      .update({ repartidor_id: body.repartidor_id, estado: 'pendiente' })
      .eq('id', entrega.id as string)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase
      .from('delivery_queue')
      .update({ repartidor_pref_id: body.repartidor_id, estado: 'asignado' })
      .eq('pedido_id', body.pedido_id)
      .eq('ferreteria_id', session.ferreteriaId)
      .in('estado', ['esperando', 'bloqueado'])

    await supabase
      .from('repartidores')
      .update({ estado_operativo: 'en_ruta' })
      .eq('id', body.repartidor_id)
      .eq('ferreteria_id', session.ferreteriaId)

    await recalcularETAsCascada(session.ferreteriaId, supabase)

    return NextResponse.json({ ok: true, metodo: 'manual', repartidorId: body.repartidor_id })
  }

  // ── B) Reasignación automática vía OSRM ──────────────────────────────────
  if (body.entrega_ids?.length) {
    const motivo: MotivoReasignacion = (() => {
      const m = body.motivo ?? ''
      const validos: MotivoReasignacion[] = [
        'averia_vehiculo', 'averia_leve', 'repartidor_emergencia',
        'repartidor_no_disponible', 'cliente_ausente', 'cancelacion_en_ruta',
        'zona_bloqueada', 'sobrecarga_capacidad', 'manual_dueno',
      ]
      return (validos as string[]).includes(m) ? (m as MotivoReasignacion) : 'manual_dueno'
    })()

    const resultado = await reasignarEntregas({
      ferreteriaId: session.ferreteriaId,
      entregasIds:  body.entrega_ids,
      motivo,
      autoAprobar:  body.auto ?? true,
    }, supabase)

    return NextResponse.json({
      ok:                  true,
      metodo:              'automatico',
      exito:               resultado.exito,
      reasignaciones:      resultado.entregasReasignadas,
      requiereAprobacion:  resultado.requiereAprobacion,
      mensajeMotivo:       resultado.motivo,
    })
  }

  return NextResponse.json({ error: 'Parámetros insuficientes: proveer pedido_id+repartidor_id o entrega_ids[]' }, { status: 400 })
}
