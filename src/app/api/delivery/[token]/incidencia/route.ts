/**
 * POST /api/delivery/[token]/incidencia
 * El repartidor reporta una avería o incidencia de vehículo desde el portal.
 * Este endpoint:
 *   1. Actualiza el estado del vehículo en DB
 *   2. Dispara el workflow Inngest de avería
 *   3. Notifica al dueño por WhatsApp
 *   4. Registra en delivery_operaciones_log
 *
 * Body:
 *   {
 *     tipo:        string  — 'pinchadura'|'bateria'|'motor'|'accidente'|'otro'
 *     descripcion: string  — detalle libre
 *     grave:       boolean — si es grave, dispara reasignación automática
 *     vehiculo_id?: string — si no se provee, se deduce del repartidor
 *   }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'
import { getYCloudApiKey } from '@/lib/tenant'
import { inngest } from '@/lib/inngest/client'

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
    .select('id, nombre, ferreteria_id, vehiculo_id, ferreterias(nombre, telefono_whatsapp, telefono_dueno)')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await req.json() as {
    tipo:         string
    descripcion:  string
    grave:        boolean
    vehiculo_id?: string
  }

  if (!body.tipo || !body.descripcion) {
    return NextResponse.json({ error: 'tipo y descripcion requeridos' }, { status: 400 })
  }

  const vehiculoId = body.vehiculo_id ?? (repartidor.vehiculo_id as string | null)
  const ferr = repartidor.ferreterias as any
  const estadoVehiculo = body.grave ? 'averia_grave' : 'averia_leve'

  // 1. Actualizar estado del vehículo si tenemos ID
  if (vehiculoId) {
    await supabase
      .from('vehiculos_delivery')
      .update({
        estado:              estadoVehiculo,
        descripcion_averia:  `${body.tipo}: ${body.descripcion}`,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', vehiculoId)
      .eq('ferreteria_id', repartidor.ferreteria_id)
  }

  // 2. Actualizar estado operativo del repartidor
  await supabase
    .from('repartidores')
    .update({ estado_operativo: 'averia' })
    .eq('id', repartidor.id)

  // 3. Registrar en log de operaciones
  await supabase
    .from('delivery_operaciones_log')
    .insert({
      ferreteria_id: repartidor.ferreteria_id,
      tipo_evento:   body.grave ? 'vehiculo_averia_grave' : 'vehiculo_averia_leve',
      entidad_tipo:  'repartidor',
      entidad_id:    repartidor.id,
      detalle: {
        tipo_averia:  body.tipo,
        descripcion:  body.descripcion,
        grave:        body.grave,
        vehiculo_id:  vehiculoId,
        origen:       'portal_repartidor',
      },
      origen:   'portal_repartidor',
      resuelto: false,
    })

  // 4. Notificar al dueño por WhatsApp (fire-and-forget)
  if (ferr?.telefono_whatsapp && ferr?.telefono_dueno) {
    getYCloudApiKey(repartidor.ferreteria_id as string)
      .then((apiKey) => {
        if (!apiKey) return
        const emoji   = body.grave ? '🚨' : '⚠️'
        const titulo  = body.grave ? 'AVERÍA GRAVE' : 'AVERÍA LEVE'
        const tipoMap: Record<string, string> = {
          pinchadura: 'Llanta pinchada',
          bateria:    'Batería agotada',
          motor:      'Falla de motor',
          accidente:  'Accidente',
          otro:       'Otro problema',
        }
        const tipoLabel = tipoMap[body.tipo] ?? body.tipo
        enviarMensaje({
          from:  ferr.telefono_whatsapp.replace(/^\+/, ''),
          to:    ferr.telefono_dueno,
          texto: `${emoji} *${titulo} — ${ferr.nombre}*\n\nRepartidor: *${repartidor.nombre}*\nProblema: ${tipoLabel}\nDetalle: ${body.descripcion}\n\n${body.grave ? '⚡ Reasignación automática iniciada.' : 'Repartidor avisado de continuar o esperar asistencia.'}`,
          apiKey,
        }).catch((e) => console.error('[Delivery] Error notif avería dueño:', e))
      })
      .catch(() => {})
  }

  // 5. Disparar Inngest (avería grave = reasignación automática)
  if (body.grave && vehiculoId) {
    inngest.send({
      name: 'delivery/vehiculo.averia',
      data: {
        ferreteriaId:      repartidor.ferreteria_id,
        vehiculoId,
        repartidorId:      repartidor.id,
        descripcion:       `${body.tipo}: ${body.descripcion}`,
        grave:             true,
        tiempoEstimadoMin: null,
      },
    }).catch((e) => console.error('[Delivery] Error enviando evento avería:', e))
  }

  return NextResponse.json({
    ok:      true,
    grave:   body.grave,
    mensaje: body.grave
      ? 'Avería grave reportada. Iniciando reasignación automática.'
      : 'Avería leve registrada. El dueño fue notificado.',
  })
}
