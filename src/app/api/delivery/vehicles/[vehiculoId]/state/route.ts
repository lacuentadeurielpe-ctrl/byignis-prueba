/**
 * PATCH /api/delivery/vehicles/[vehiculoId]/state
 * Cambia el estado de un vehículo (disponible / averia_leve / averia_grave / mantenimiento / fuera_servicio)
 * y dispara el workflow Inngest si es una avería.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

const ESTADOS_VALIDOS = ['disponible', 'en_uso', 'averia_leve', 'averia_grave', 'mantenimiento', 'fuera_servicio']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ vehiculoId: string }> }
) {
  const { vehiculoId } = await params

  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as {
    estado:               string
    descripcion_averia?:  string | null
    est_resolucion_at?:   string | null
    repartidor_id?:       string | null
  }

  if (!ESTADOS_VALIDOS.includes(body.estado)) {
    return NextResponse.json({ error: `Estado inválido: ${body.estado}` }, { status: 400 })
  }

  const supabase = await createClient()

  // Verificar que el vehículo pertenece a la ferretería
  const { data: vehiculo, error: vError } = await supabase
    .from('vehiculos_delivery')
    .select('id, estado, nombre')
    .eq('id', vehiculoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (vError || !vehiculo) {
    return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
  }

  // Actualizar estado
  const updatePayload: Record<string, unknown> = {
    estado:            body.estado,
    updated_at:        new Date().toISOString(),
  }

  if (body.descripcion_averia !== undefined) updatePayload.descripcion_averia = body.descripcion_averia
  if (body.est_resolucion_at  !== undefined) updatePayload.est_resolucion_at  = body.est_resolucion_at
  if (body.estado === 'disponible') {
    updatePayload.descripcion_averia = null
    updatePayload.est_resolucion_at  = null
  }

  const { error: updateError } = await supabase
    .from('vehiculos_delivery')
    .update(updatePayload)
    .eq('id', vehiculoId)
    .eq('ferreteria_id', session.ferreteriaId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Si es avería grave/leve Y hay un repartidor afectado → disparar workflow
  if (['averia_leve', 'averia_grave'].includes(body.estado) && body.repartidor_id) {
    const supabaseAdmin = createAdminClient()

    // Registrar en log
    await supabaseAdmin.from('delivery_operaciones_log').insert({
      ferreteria_id: session.ferreteriaId,
      tipo_evento:   body.estado === 'averia_grave' ? 'vehiculo_averia_grave' : 'vehiculo_averia_leve',
      entidad_tipo:  'vehiculo',
      entidad_id:    vehiculoId,
      detalle: {
        descripcion:   body.descripcion_averia,
        repartidor_id: body.repartidor_id,
      },
      origen:   'dashboard',
      resuelto: false,
    })

    // Disparar Inngest workflow
    await inngest.send({
      name: 'delivery/vehiculo.averia',
      data: {
        ferreteriaId:       session.ferreteriaId,
        vehiculoId,
        repartidorId:       body.repartidor_id,
        descripcion:        body.descripcion_averia ?? 'Avería reportada desde dashboard',
        grave:              body.estado === 'averia_grave',
        tiempoEstimadoMin:  null,
      },
    })
  }

  return NextResponse.json({ ok: true, estado: body.estado })
}
