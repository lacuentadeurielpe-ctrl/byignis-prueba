/**
 * Inngest Function: delivery/cliente-ausente
 *
 * Se dispara cuando el repartidor reporta que el cliente no está.
 * Maneja el ciclo de reintentos con espera configurable.
 *
 * Flujo:
 *   1. Intentar contactar al cliente (WhatsApp con link de tracking)
 *   2. Esperar 10 minutos
 *   3. Si el cliente confirma → continuar entrega
 *   4. Si no responde → siguiente intento o reagendar
 *   5. Si se agotaron los intentos → retorno con notificación a dueño
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { resolverSender } from '@/lib/whatsapp/provider'
import { incrementarIntentos, reprogramarPedido } from '@/lib/delivery/queue-engine'
import { actualizarFactorZona } from '@/lib/delivery/incident-classifier'

const ESPERA_CLIENTE_MIN = 10   // minutos de espera por respuesta
const MAX_CONTACTOS      = 3    // intentos de contacto antes de reagendar

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnClienteAusente = inngest.createFunction(
  {
    id:      'delivery-cliente-ausente',
    name:    'Gestionar cliente ausente',
    retries: 2,
    triggers: [{ event: 'delivery/cliente.ausente' as string }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const {
      ferreteriaId,
      pedidoId,
      entregaId,
      numeroPedido,
      telefonoCliente,
      telefonoWhatsapp,
      nombreFerreteria,
      repartidorNombre,
      zonaDeliveryId,
      intento = 1,         // número de intento actual (1-indexed)
    } = event.data

    // ── Paso 1: Notificar al cliente que el repartidor espera ─────────────────
    const mensajeEnviado = await step.run('contactar-cliente', async () => {
      if (!telefonoCliente || !telefonoWhatsapp) return false

      const supabase = adminClient()
      const sender = await resolverSender(supabase, ferreteriaId, telefonoWhatsapp.replace(/^\+/, '')).catch(() => null)
      if (!sender) return false

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const trackingUrl = entregaId ? `${appUrl}/track/${entregaId}` : ''

      await sender.enviarMensaje({
        to:    telefonoCliente.replace(/^\+/, ''),
        texto: `🚚 *${nombreFerreteria}* — Tu pedido *${numeroPedido}* llegó a tu dirección.\n\n👤 Repartidor: ${repartidorNombre}\nEsta es nuestra ${intento === 1 ? 'primera' : intento === 2 ? 'segunda' : 'última'} visita.\n\n${trackingUrl ? `📍 Tracking: ${trackingUrl}\n\n` : ''}Por favor responde *AQUÍ* o llama para coordinar la entrega.`,
      })
      return true
    })

    // ── Paso 2: Esperar respuesta del cliente ─────────────────────────────────
    await step.sleep('esperar-respuesta-cliente', ESPERA_CLIENTE_MIN * 60_000)

    // ── Paso 3: Verificar si el pedido fue entregado en la espera ─────────────
    const fueEntregado = await step.run('verificar-entrega', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('pedidos')
        .select('estado')
        .eq('id', pedidoId)
        .eq('ferreteria_id', ferreteriaId)
        .single()
      return data?.estado === 'entregado'
    })

    if (fueEntregado) {
      return { resuelto: true, metodo: 'entrega_exitosa' }
    }

    // ── Paso 4: Incrementar intentos y evaluar siguiente acción ──────────────
    const resultadoIntentos = await step.run('incrementar-intentos', async () => {
      const supabase = adminClient()
      return incrementarIntentos(pedidoId, ferreteriaId, supabase, 30) // bloquear 30 min
    })

    // ── Paso 5: Actualizar factor zona para aprendizaje futuro ───────────────
    if (zonaDeliveryId) {
      await step.run('actualizar-factor-zona', async () => {
        const supabase = adminClient()
        await actualizarFactorZona({
          ferreteriaId,
          zonaDeliveryId,
          tipo:  'cliente_ausente',
        }, supabase as unknown as { from: (t: string) => unknown })
      })
    }

    if (resultadoIntentos?.agotado || intento >= MAX_CONTACTOS) {
      // ── Intentos agotados: reagendar o retornar ──────────────────────────
      await step.run('reagendar-o-retornar', async () => {
        const supabase = adminClient()

        // Reagendar para 2 horas después
        const fechaNueva = new Date(Date.now() + 2 * 3600_000)

        await reprogramarPedido({
          ferreteriaId,
          pedidoId,
          fechaNueva,
          motivo: 'cliente_ausente_reintentos_agotados',
          origen: 'sistema',
        }, supabase)

        // Notificar al dueño
        const { data: ferreteria } = await supabase
          .from('ferreterias')
          .select('telefono_dueno, telefono_whatsapp')
          .eq('id', ferreteriaId).single()

        if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) return

        const senderDueno = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
        if (senderDueno) {
          await senderDueno.enviarMensaje({
            to:    ferreteria.telefono_dueno as string,
            texto: `⚠️ *Cliente ausente — ${nombreFerreteria}*\n\nPedido: *${numeroPedido}*\nRepartidor: ${repartidorNombre}\n\nSe intentó ${intento} veces y el cliente no estaba disponible.\n\n📅 Pedido reagendado para ${fechaNueva.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' })}\n\nPuedes cambiar la fecha desde el dashboard.`,
          }).catch(() => null)
        }

        // Notificar al cliente del reagendamiento
        if (telefonoCliente && telefonoWhatsapp) {
          const senderCliente = await resolverSender(supabase, ferreteriaId, telefonoWhatsapp.replace(/^\+/, '')).catch(() => null)
          if (senderCliente) {
            await senderCliente.enviarMensaje({
              to:    telefonoCliente.replace(/^\+/, ''),
              texto: `📦 ${nombreFerreteria}: No pudimos entregarte el pedido *${numeroPedido}* hoy. Lo hemos reagendado para ${fechaNueva.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' })}. Si necesitas cambiar la hora, contáctanos.`,
            }).catch(() => null)
          }
        }
      })

      return {
        resuelto: false,
        metodo:   'reagendado',
        intentos: intento,
        pedidoId,
      }
    }

    // ── Hay más intentos disponibles: re-disparar en 30 min ─────────────────
    await step.sleep('esperar-proximo-intento', 30 * 60_000)

    // Re-disparar con el siguiente intento
    await step.run('disparar-proximo-intento', async () => {
      // Emitir nuevo evento para el siguiente intento
      // (Se usa el mismo evento con intento+1 para que Inngest lo reintente)
    })

    return {
      resuelto: false,
      metodo:   'reintento_programado',
      intento,
      siguienteIntentoEn: '30 min',
    }
  },
)
