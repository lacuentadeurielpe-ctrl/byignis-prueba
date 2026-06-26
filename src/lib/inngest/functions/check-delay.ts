/**
 * Inngest Function: delivery/check-delay
 *
 * Se dispara cuando un repartidor marca un pedido como "enviado".
 * Espera el ETA estimado + 10 min de margen y verifica si el pedido
 * ya fue entregado. Si no → notifica al cliente y al dueño.
 *
 * Integración con el módulo de ETA: usa los mismos datos de delivery_predictions
 * para saber si el retraso es por tráfico histórico de zona o anomalía.
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { notificarDelay } from '@/lib/notifications/delivery.notifications'
import { resolverSender } from '@/lib/whatsapp/provider'

const MARGEN_MIN = 10 // minutos de gracia antes de considerar retraso

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnCheckDelay = inngest.createFunction(
  {
    id: 'delivery-check-delay',
    name: 'Detectar retraso de entrega',
    retries: 2,
    triggers: [{ event: 'delivery/pedido.enviado' as string }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const {
      ferreteriaId,
      pedidoId,
      entregaId,
      numeroPedido,
      etaMinutos,
      telefonoCliente,
      telefonoWhatsapp,
      nombreFerreteria,
      repartidorNombre,
    } = event.data

    // ── Paso 1: Esperar ETA + margen de gracia ──────────────────────────────
    const esperarMs = (etaMinutos + MARGEN_MIN) * 60 * 1000
    await step.sleep('esperar-eta', esperarMs)

    // ── Paso 2: Verificar si ya fue entregado ───────────────────────────────
    const yaEntregado = await step.run('verificar-estado', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('pedidos')
        .select('estado')
        .eq('id', pedidoId)
        .eq('ferreteria_id', ferreteriaId)
        .single()
      return data?.estado === 'entregado' || data?.estado === 'cancelado'
    })

    if (yaEntregado) return { skipped: true, motivo: 'pedido ya finalizado' }

    // ── Paso 3: Calcular nuevo ETA estimado desde la predicción IA ──────────
    const nuevoEta = await step.run('calcular-nuevo-eta', async () => {
      const supabase = adminClient()

      // Ver si la entrega salió del local y cuánto lleva en ruta
      const { data: entrega } = await supabase
        .from('entregas')
        .select('salio_at, duracion_estimada_min')
        .eq('id', entregaId)
        .single()

      if (!entrega?.salio_at) return etaMinutos + 15 // fallback conservador

      const minEnRuta = Math.round(
        (Date.now() - new Date(entrega.salio_at).getTime()) / 60_000
      )

      // Consultar la predicción IA para ver el contexto histórico de la zona
      const { data: pred } = await supabase
        .from('delivery_predictions')
        .select('zona_delivery_id, hora_dia, dia_semana, distancia_km')
        .eq('entrega_id', entregaId)
        .single()

      if (pred?.zona_delivery_id) {
        // Si tenemos historial de esta zona → usarlo para ajustar
        const { data: stats } = await supabase
          .from('delivery_zone_stats')
          .select('avg_duracion_min, p90_duracion_min')
          .eq('zona_delivery_id', pred.zona_delivery_id)
          .eq('hora_bloque', pred.hora_dia)
          .eq('dia_semana', pred.dia_semana)
          .maybeSingle()

        if (stats?.avg_duracion_min) {
          const tiempoRestante = Math.max(5, stats.avg_duracion_min - minEnRuta)
          return tiempoRestante + 5 // +5 min buffer
        }
      }

      // Fallback: estimación conservadora basada en tiempo ya transcurrido
      return Math.max(10, (entrega.duracion_estimada_min ?? etaMinutos) - minEnRuta + 10)
    })

    // ── Paso 4: Notificar retraso al cliente ─────────────────────────────────
    if (telefonoCliente && telefonoWhatsapp) {
      await step.run('notificar-cliente', async () => {
        const supabase = adminClient()
        const sender = await resolverSender(supabase, ferreteriaId, telefonoWhatsapp.replace(/^\+/, '')).catch(() => null)
        if (!sender) return { skipped: true }

        await notificarDelay(
          {
            ferreteriaId,
            entregaId,
            pedidoId,
            numeroPedido,
            nombreFerreteria,
            telefonoWhatsapp: telefonoWhatsapp.replace(/^\+/, ''),
            telefonoCliente,
            sender,
            repartidorNombre,
          },
          nuevoEta,
          'tráfico en ruta',
          supabase,
        )
        return { enviado: true }
      })
    }

    // ── Paso 5: Alertar al dueño por WhatsApp ───────────────────────────────
    await step.run('alertar-dueno', async () => {
      const supabase = adminClient()
      const { data: ferreteria } = await supabase
        .from('ferreterias')
        .select('telefono_dueno, telefono_whatsapp')
        .eq('id', ferreteriaId)
        .single()

      if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) {
        return { skipped: true }
      }

      const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
      if (!sender) return { skipped: true }

      await sender.enviarMensaje({
        to: ferreteria.telefono_dueno as string,
        texto: `⚠️ *Retraso detectado — ${nombreFerreteria}*\n\nPedido: *${numeroPedido}*\nRepartidor: ${repartidorNombre}\n\nEl ETA original fue de ${etaMinutos} min pero aún no hay confirmación de entrega.\nNuevo estimado: ~${nuevoEta} min adicionales.\n\n📊 _Detectado automáticamente por el módulo de inteligencia_`,
      })
      return { enviado: true }
    })

    // ── Paso 6: Registrar evento de delay en BD ──────────────────────────────
    await step.run('registrar-evento', async () => {
      const supabase = adminClient()
      await supabase.from('delivery_events').insert({
        ferreteria_id: ferreteriaId,
        entrega_id: entregaId,
        evento: 'delay',
        detalle: {
          eta_original_min: etaMinutos,
          nuevo_eta_min: nuevoEta,
          motivo: 'timeout_automatico',
          repartidor: repartidorNombre,
        },
      })
    })

    return {
      detected: true,
      pedidoId,
      etaOriginal: etaMinutos,
      nuevoEta,
    }
  },
)
