/**
 * Inngest Function: unassigned-alert (Cron)
 *
 * Cron cada 20 minutos (en horario de operación Lima: 8am - 9pm).
 * Busca pedidos delivery sin repartidor asignado con >15 min esperando.
 * Si encuentra → notifica al dueño por WhatsApp con el resumen de cola.
 *
 * También integra con el módulo de ETA para calcular el impacto del retraso:
 * "El cliente del pedido PED-042 ya lleva 25 min esperando. ETA original: 30 min."
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { getYCloudApiKey } from '@/lib/tenant'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'

const MINUTOS_ESPERA_ALERTA = 15 // alertar si espera más de 15 min sin asignar

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnUnassignedAlert = inngest.createFunction(
  {
    id: 'delivery-unassigned-alert',
    name: 'Alerta de pedidos sin asignar',
    retries: 1,
    // Cron cada 20 min en horario operativo Lima (UTC-5 = +5h desde UTC)
    // 8:00am Lima = 13:00 UTC → 9:00pm Lima = 02:00 UTC siguiente día
    triggers: [{ cron: '*/20 13-23,0-2 * * *' }],
  },
  async ({ step }: { step: any }) => {
    // ── Obtener todas las ferreterías activas ──────────────────────────────
    const ferreterias = await step.run('obtener-ferreterias', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('ferreterias')
        .select('id, nombre, telefono_dueno, telefono_whatsapp')
        .eq('activo', true)
        .not('telefono_dueno', 'is', null)
      return data ?? []
    })

    const alertas: Array<{ ferreteriaId: string; pedidosCount: number }> = []

    // ── Por cada ferretería, revisar cola ──────────────────────────────────
    for (const ferreteria of ferreterias) {
      const resultado = await step.run(`check-cola-${ferreteria.id}`, async () => {
        const supabase = adminClient()

        const corteHora = new Date(Date.now() - MINUTOS_ESPERA_ALERTA * 60_000).toISOString()

        // Pedidos delivery confirmados, creados hace más de MINUTOS_ESPERA_ALERTA
        const { data: pedidosCandidatos } = await supabase
          .from('pedidos')
          .select(`
            id, numero_pedido, nombre_cliente, created_at, eta_minutos, direccion_entrega,
            entregas!left(id, repartidor_id, estado)
          `)
          .eq('ferreteria_id', ferreteria.id)
          .eq('modalidad', 'delivery')
          .in('estado', ['confirmado', 'en_preparacion'])
          .lt('created_at', corteHora)

        // Solo los que no tienen repartidor asignado
        const sinAsignar = (pedidosCandidatos ?? []).filter((p: any) => {
          const entrega = p.entregas?.[0]
          return !entrega?.repartidor_id
        })

        if (sinAsignar.length === 0) return { alertado: false, count: 0 }

        // Verificar si ya enviamos alerta en los últimos 40 min (anti-spam)
        const cutoff40 = new Date(Date.now() - 40 * 60_000).toISOString()
        const { data: alertaReciente } = await supabase
          .from('delivery_events')
          .select('id')
          .eq('ferreteria_id', ferreteria.id)
          .eq('evento', 'sin_asignar_alerta')
          .gte('created_at', cutoff40)
          .limit(1)

        if (alertaReciente?.length) return { alertado: false, count: sinAsignar.length, motivo: 'cooldown' }

        // Armar el mensaje con detalle de cada pedido
        const lineas = sinAsignar.slice(0, 5).map((p: any) => {
          const minEsperando = Math.round((Date.now() - new Date(p.created_at).getTime()) / 60_000)
          const eta = p.eta_minutos ? ` (ETA orig: ${p.eta_minutos}min)` : ''
          return `  • *${p.numero_pedido}* — ${p.nombre_cliente}${eta}\n    ⏳ ${minEsperando} min esperando sin repartidor`
        }).join('\n')

        const extra = sinAsignar.length > 5 ? `\n  ...y ${sinAsignar.length - 5} más` : ''

        const apiKey = await getYCloudApiKey(ferreteria.id).catch(() => null)
        if (!apiKey || !ferreteria.telefono_whatsapp || !ferreteria.telefono_dueno) {
          return { alertado: false, count: sinAsignar.length, motivo: 'sin_config' }
        }

        await enviarMensaje({
          from: (ferreteria.telefono_whatsapp as string).replace(/^\+/, ''),
          to: ferreteria.telefono_dueno as string,
          texto: `🚨 *Cola sin asignar — ${ferreteria.nombre}*\n\n*${sinAsignar.length} pedido(s)* llevan más de ${MINUTOS_ESPERA_ALERTA} min sin repartidor:\n\n${lineas}${extra}\n\n👉 Asigna desde el *dashboard de Delivery* para no demorar más al cliente.`,
          apiKey,
        })

        // Registrar el evento para el anti-spam
        await supabase.from('delivery_events').insert({
          ferreteria_id: ferreteria.id,
          entrega_id: sinAsignar[0].entregas?.[0]?.id ?? sinAsignar[0].id,
          evento: 'sin_asignar_alerta',
          detalle: { pedidos_count: sinAsignar.length, pedidos: sinAsignar.map((p: any) => p.numero_pedido) },
        })

        return { alertado: true, count: sinAsignar.length }
      })

      if (resultado.alertado) {
        alertas.push({ ferreteriaId: ferreteria.id, pedidosCount: resultado.count })
      }
    }

    return { ferreterias: ferreterias.length, alertasEnviadas: alertas.length, alertas }
  },
)
