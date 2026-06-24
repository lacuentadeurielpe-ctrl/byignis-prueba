// GET /api/cron/recordatorios-deuda
// Enviado por Vercel Cron cada día a las 9am Lima (14:00 UTC)
// Protegido por Authorization: Bearer CRON_SECRET
//
// Lógica:
//  - Itera ferreterias con config_recordatorios_deuda.activo = true
//  - Para cada ferretería, busca créditos activos/vencidos donde:
//      fecha_limite <= hoy - dias_gracia
//      monto_pagado < monto_total
//      cliente_id IS NOT NULL (con teléfono disponible)
//      ultimo_recordatorio_enviado_at IS NULL o anterior al día de hoy (Lima)
//  - Envía 1 WhatsApp de recordatorio por crédito y actualiza ultimo_recordatorio_enviado_at

import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'
import { getYCloudApiKey } from '@/lib/tenant'
import { inicioDiaLima } from '@/lib/tiempo'
import { formatPEN } from '@/lib/utils'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Fecha de hoy en Lima como string DATE (YYYY-MM-DD)
function hoyLima(): string {
  return new Date(inicioDiaLima(0)).toISOString().split('T')[0]
}

export async function GET(request: Request) {
  const auth   = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = adminClient()
  const hoy      = hoyLima()

  // 1. Ferreterias con recordatorios activos y WhatsApp configurado
  const { data: ferreterias, error: errF } = await supabase
    .from('ferreterias')
    .select('id, nombre, telefono_whatsapp')
    .not('telefono_whatsapp', 'is', null)

  if (errF) {
    console.error('[cron/recordatorios-deuda] Error obteniendo ferreterías:', errF)
    return NextResponse.json({ error: errF.message }, { status: 500 })
  }

  let totalEnviados = 0
  let totalErrores  = 0

  for (const ferreteria of (ferreterias ?? [])) {
    // 2. Leer config de recordatorios del tenant
    const { data: config } = await supabase
      .from('configuracion_bot')
      .select('config_recordatorios_deuda')
      .eq('ferreteria_id', ferreteria.id)
      .maybeSingle()

    const cfg = (config?.config_recordatorios_deuda ?? {}) as {
      activo?: boolean
      dias_gracia?: number
      mensaje_custom?: string
    }

    if (!cfg.activo) continue

    const diasGracia   = Math.max(0, Number(cfg.dias_gracia ?? 1))
    const mensajeExtra = (cfg.mensaje_custom ?? '').trim()

    // fecha tope: hoy - dias_gracia (creditos con fecha_limite anterior a esto)
    const fechaTope = new Date(hoy)
    fechaTope.setDate(fechaTope.getDate() - diasGracia)
    const fechaTopeStr = fechaTope.toISOString().split('T')[0]

    // 3. Creditos que necesitan recordatorio
    const { data: creditos, error: errC } = await supabase
      .from('creditos')
      .select(`
        id, monto_total, monto_pagado, fecha_limite, notas, ultimo_recordatorio_enviado_at,
        clientes ( id, nombre, telefono )
      `)
      .eq('ferreteria_id', ferreteria.id)
      .in('estado', ['activo', 'vencido'])
      .lte('fecha_limite', fechaTopeStr)
      .not('cliente_id', 'is', null)

    if (errC) {
      console.error(`[cron/recordatorios-deuda] Error creditos ferretería ${ferreteria.id}:`, errC)
      continue
    }

    for (const credito of (creditos ?? []) as any[]) {
      const saldo = Number(credito.monto_total) - Number(credito.monto_pagado)
      if (saldo <= 0) continue

      const cliente = credito.clientes
      if (!cliente?.telefono) continue

      // Evitar duplicados: ya enviado hoy
      if (credito.ultimo_recordatorio_enviado_at) {
        const yaEnviadoHoy = credito.ultimo_recordatorio_enviado_at.startsWith(hoy)
        if (yaEnviadoHoy) continue
      }

      // Marcar crédito como vencido si aún es 'activo' y pasó la fecha
      if (credito.estado === 'activo' && credito.fecha_limite < hoy) {
        await supabase.from('creditos').update({ estado: 'vencido' }).eq('id', credito.id)
      }

      // 4. Construir mensaje
      const diasVencido = Math.floor(
        (Date.now() - new Date(credito.fecha_limite).getTime()) / (1000 * 60 * 60 * 24)
      )
      const vencidoTexto = diasVencido > 0 ? ` (vencido hace ${diasVencido} día${diasVencido > 1 ? 's' : ''})` : ''

      const mensaje = [
        `Hola ${cliente.nombre} 👋`,
        ``,
        `Te recordamos que tienes un crédito pendiente con *${ferreteria.nombre}*:`,
        ``,
        `💳 Total: ${formatPEN(Number(credito.monto_total))}`,
        `✅ Pagado: ${formatPEN(Number(credito.monto_pagado))}`,
        `⚠️ *Saldo pendiente: ${formatPEN(saldo)}*`,
        `📅 Venció: ${credito.fecha_limite}${vencidoTexto}`,
        ``,
        mensajeExtra || 'Por favor comunícate con nosotros para coordinar el pago. ¡Gracias!',
      ].join('\n')

      try {
        const apiKey = await getYCloudApiKey(ferreteria.id)
        if (!apiKey) continue

        await enviarMensaje({
          apiKey,
          from:   ferreteria.telefono_whatsapp,
          to:     `+${cliente.telefono}`,
          texto:  mensaje,
        })

        // 5. Actualizar timestamp del último recordatorio
        await supabase
          .from('creditos')
          .update({ ultimo_recordatorio_enviado_at: new Date().toISOString() })
          .eq('id', credito.id)

        totalEnviados++
      } catch (err) {
        console.error(`[cron/recordatorios-deuda] Error enviando a ${cliente.telefono}:`, err)
        totalErrores++
      }
    }
  }

  console.log(`[cron/recordatorios-deuda] Completado: ${totalEnviados} enviados, ${totalErrores} errores`)
  return NextResponse.json({ ok: true, enviados: totalEnviados, errores: totalErrores })
}
