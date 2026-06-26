/**
 * Inngest Function: delivery/pedido-programado
 *
 * Gestiona el ciclo de vida de un pedido programado para entrega futura.
 * Se dispara cuando se crea un pedido programado y duerme hasta la hora.
 *
 * Flujo:
 *   1. Dormir hasta (horaProgramada - 30 min) → buscar repartidor disponible
 *   2. Si no hay repartidor: notificar al dueño y volver a intentar -15min
 *   3. En horaProgramada: disparar asignación y notificar al cliente
 *   4. Si sigue sin repartidor: escalar al dueño con alerta crítica
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { resolverSender } from '@/lib/whatsapp/provider'
import { crearEntrega } from '@/lib/delivery/assignment'
import { encolarPedido } from '@/lib/delivery/queue-engine'
import { calcularCascadaETA } from '@/lib/delivery/cascade-eta'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnPedidoProgramado = inngest.createFunction(
  {
    id:      'delivery-pedido-programado',
    name:    'Gestionar pedido programado',
    retries: 3,
    triggers: [{ event: 'delivery/pedido.programado' as string }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const {
      ferreteriaId,
      pedidoId,
      numeroPedido,
      horaProgramadaAt,  // ISO string
      telefonoCliente,
      telefonoWhatsapp,
      nombreFerreteria,
      pesoTotalKg = 0,
      zonaDeliveryId,
    } = event.data

    const horaMs = new Date(horaProgramadaAt).getTime()

    // ── Paso 1: Dormir hasta 30 minutos antes ─────────────────────────────────
    const preaviso30ms = horaMs - 30 * 60_000 - Date.now()
    if (preaviso30ms > 5000) {
      await step.sleep('esperar-preaviso-30min', preaviso30ms)
    }

    // ── Paso 2: Verificar disponibilidad de repartidores ──────────────────────
    const hayRepartidor = await step.run('verificar-disponibilidad', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('repartidores')
        .select('id')
        .eq('ferreteria_id', ferreteriaId)
        .in('estado_operativo', ['disponible'])
        .limit(1)
      return (data?.length ?? 0) > 0
    })

    if (!hayRepartidor) {
      // Notificar al dueño: sin repartidor disponible en 30 min
      await step.run('notificar-dueno-sin-repartidor', async () => {
        const supabase = adminClient()

        const { data: ferreteria } = await supabase
          .from('ferreterias')
          .select('telefono_dueno, telefono_whatsapp')
          .eq('id', ferreteriaId).single()

        if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) return

        const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
        if (!sender) return

        await sender.enviarMensaje({
          to:    ferreteria.telefono_dueno as string,
          texto: `⚠️ *Pedido programado sin repartidor — ${nombreFerreteria}*\n\nEl pedido *${numeroPedido}* está programado para las ${new Date(horaProgramadaAt).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })} y *no hay repartidores disponibles*.\n\nAsigna un repartidor o el sistema intentará de nuevo en 15 min.`,
        })
      })
    }

    // ── Paso 3: Dormir hasta 15 minutos antes de la hora programada ───────────
    const preaviso15ms = horaMs - 15 * 60_000 - Date.now()
    if (preaviso15ms > 5000) {
      await step.sleep('esperar-preaviso-15min', preaviso15ms)
    }

    // ── Paso 4: Encolar con prioridad PROGRAMADO (5) ──────────────────────────
    await step.run('encolar-pedido', async () => {
      const supabase = adminClient()
      await encolarPedido({
        ferreteriaId,
        pedidoId,
        prioridad:      5,
        pesoTotalKg,
        zonaDeliveryId: zonaDeliveryId ?? undefined,
        noAntesDe:      new Date(horaProgramadaAt),
      }, supabase)
    })

    // ── Paso 5: Dormir hasta la hora exacta de despacho ───────────────────────
    const esperarHoraMs = horaMs - Date.now()
    if (esperarHoraMs > 1000) {
      await step.sleep('esperar-hora-programada', esperarHoraMs)
    }

    // ── Paso 6: Asignar repartidor y crear entrega ────────────────────────────
    const entregaId = await step.run('asignar-y-crear-entrega', async () => {
      const supabase = adminClient()

      // Obtener datos del pedido
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('cliente_lat, cliente_lng, estado, ferreterias!inner(lat, lng)')
        .eq('id', pedidoId).single()

      if (!pedido || pedido.estado === 'cancelado') return null

      // Calcular ETA real con cascade-eta
      let etaMinutos = 30
      try {
        const ferrRow = (Array.isArray(pedido.ferreterias) ? pedido.ferreterias[0] : pedido.ferreterias) as { lat?: number; lng?: number } | null
        if (ferrRow?.lat && pedido.cliente_lat) {
          const cascada = await calcularCascadaETA({
            ferreteriaId,
            ferreteriaCoords: { lat: ferrRow.lat, lng: ferrRow.lng ?? 0 },
            clienteCoords:    { lat: pedido.cliente_lat as number, lng: pedido.cliente_lng as number },
            pesoTotalKg,
            zonaDeliveryId:  zonaDeliveryId ?? undefined,
            horaProgramadaAt: new Date(horaProgramadaAt),
            supabase,
          })
          etaMinutos = cascada.etaMinutos
        }
      } catch { /* fallback */ }

      const id = await crearEntrega({
        ferreteriaId,
        pedidoId,
        repartidorId: null,
        etaMinutos,
        prioridad: 5,
        pesoTotalKg,
        zonaDeliveryId,
        horaProgramadaAt: new Date(horaProgramadaAt),
        supabase,
      })
      return id
    })

    if (!entregaId) {
      // Pedido cancelado o sin datos — terminar
      return { skipped: true, motivo: 'pedido cancelado o sin datos' }
    }

    // ── Paso 7: Notificar al cliente que su pedido está siendo preparado ───────
    if (telefonoCliente && telefonoWhatsapp) {
      await step.run('notificar-cliente', async () => {
        const supabase = adminClient()
        const sender = await resolverSender(supabase, ferreteriaId, telefonoWhatsapp.replace(/^\+/, '')).catch(() => null)
        if (!sender) return

        const hora = new Date(horaProgramadaAt).toLocaleTimeString('es-PE', {
          timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit',
        })

        await sender.enviarMensaje({
          to:    telefonoCliente,
          texto: `🚀 *¡Tu pedido programado está en camino!*\n\n${nombreFerreteria} está preparando tu pedido *${numeroPedido}* que programaste para las ${hora}.\n\n📦 En breve sale hacia tu dirección.`,
        })
      })
    }

    // ── Paso 8: Verificar en 15 min si el repartidor salió ────────────────────
    await step.sleep('esperar-confirmacion-salida', 15 * 60_000)

    await step.run('verificar-salida', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('entregas')
        .select('estado, repartidor_id')
        .eq('id', entregaId).single()

      if (data?.estado === 'pendiente' && !data?.repartidor_id) {
        // Aún sin repartidor — escalar al dueño
        const { data: ferreteria } = await supabase
          .from('ferreterias')
          .select('telefono_dueno, telefono_whatsapp')
          .eq('id', ferreteriaId).single()

        if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) return

        const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
        if (!sender) return

        await sender.enviarMensaje({
          to:    ferreteria.telefono_dueno as string,
          texto: `🔴 *Alerta: Pedido programado sin repartidor — ${nombreFerreteria}*\n\nEl pedido *${numeroPedido}* ya debería estar en camino pero *no tiene repartidor asignado*.\n\nAsigna uno manualmente desde el dashboard.`,
        })
      }
    })

    return { completado: true, pedidoId, entregaId }
  },
)
