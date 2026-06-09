/**
 * PATCH /api/delivery/drivers/[repartidorId]/state
 * Cambia el estado_operativo de un repartidor.
 * Si pasa a emergencia, dispara el workflow Inngest de emergencia.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

const ESTADOS_VALIDOS = [
  'disponible', 'en_ruta', 'entre_paradas', 'pausa',
  'no_disponible', 'averia', 'emergencia', 'fuera_turno',
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ repartidorId: string }> }
) {
  const { repartidorId } = await params

  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as {
    estado_operativo:    string
    motivo?:             string | null
    tiempo_estimado_min?: number | null
  }

  if (!ESTADOS_VALIDOS.includes(body.estado_operativo)) {
    return NextResponse.json({ error: `Estado inválido: ${body.estado_operativo}` }, { status: 400 })
  }

  const supabase = await createClient()

  // Verificar pertenencia
  const { data: rep, error: rError } = await supabase
    .from('repartidores')
    .select('id, nombre, estado_operativo')
    .eq('id', repartidorId)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (rError || !rep) {
    return NextResponse.json({ error: 'Repartidor no encontrado' }, { status: 404 })
  }

  // Actualizar estado
  const { error: updateError } = await supabase
    .from('repartidores')
    .update({ estado_operativo: body.estado_operativo })
    .eq('id', repartidorId)
    .eq('ferreteria_id', session.ferreteriaId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Si pasa a emergencia → disparar workflow Inngest
  if (body.estado_operativo === 'emergencia') {
    const supabaseAdmin = createAdminClient()

    await supabaseAdmin.from('delivery_operaciones_log').insert({
      ferreteria_id: session.ferreteriaId,
      tipo_evento:   'repartidor_emergencia',
      entidad_tipo:  'repartidor',
      entidad_id:    repartidorId,
      detalle:       { motivo: body.motivo, cambiado_por: 'dashboard' },
      origen:        'dashboard',
      resuelto:      false,
    })

    await inngest.send({
      name: 'delivery/repartidor.emergencia',
      data: {
        ferreteriaId:       session.ferreteriaId,
        repartidorId,
        motivo:             body.motivo ?? 'Estado cambiado manualmente desde dashboard',
        tiempoEstimadoMin:  body.tiempo_estimado_min ?? null,
        autoReasignar:      true,
      },
    })
  }

  return NextResponse.json({ ok: true, estado_operativo: body.estado_operativo })
}
