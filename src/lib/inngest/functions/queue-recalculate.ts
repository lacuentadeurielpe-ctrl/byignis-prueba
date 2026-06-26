/**
 * Inngest Function: delivery/cola.changed
 *
 * Se dispara cuando un pedido sale de la cola (entregado, retornado, cancelado).
 * Recalcula el ETA de todos los pedidos que siguen esperando:
 *   - Los pedidos en cola "suben" y ya no pagan la penalización de ese slot.
 *   - Si se liberó un vehículo → puede asignarse al siguiente sin repartidor.
 *
 * Integración con ETA Intelligence: usa recalcularETAsCola() que considera
 * delivery_zone_stats y delivery_predictions para dar ETAs más precisos.
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { recalcularETAsCola } from '@/lib/delivery/assignment'
import { resolverSender } from '@/lib/whatsapp/provider'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnQueueRecalculate = inngest.createFunction(
  {
    id: 'delivery-queue-recalculate',
    name: 'Recalcular cola de delivery',
    retries: 2,
    debounce: {
      period: '15s',
      key: 'event.data.ferreteriaId',
    },
    triggers: [{ event: 'delivery/cola.changed' as string }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { ferreteriaId, motivo, pedidoId } = event.data

    // ── Paso 1: Recalcular ETAs de pedidos en espera ────────────────────────
    const resultado = await step.run('recalcular-etas', async () => {
      const supabase = adminClient()
      try {
        await recalcularETAsCola(ferreteriaId, supabase)
        return { ok: true }
      } catch (e) {
        console.error('[QueueRecalculate] Error recalculando ETAs:', e)
        return { ok: false, error: String(e) }
      }
    })

    // ── Paso 2: Ver cuántos pedidos siguen sin repartidor asignado ──────────
    const colaInfo = await step.run('analizar-cola', async () => {
      const supabase = adminClient()

      // Pedidos delivery confirmados sin entrega asignada a repartidor
      const { data: sinAsignar, count } = await supabase
        .from('pedidos')
        .select(`
          id, numero_pedido, nombre_cliente, created_at, eta_minutos,
          entregas!left(id, repartidor_id, estado)
        `, { count: 'exact' })
        .eq('ferreteria_id', ferreteriaId)
        .eq('modalidad', 'delivery')
        .in('estado', ['confirmado', 'en_preparacion'])

      // Filtrar los que realmente no tienen repartidor
      const pendientes = (sinAsignar ?? []).filter((p: any) => {
        const entrega = p.entregas?.[0]
        return !entrega?.repartidor_id
      })

      // Repartidores activos disponibles (sin entrega en_ruta actualmente)
      const { data: repartidores } = await supabase
        .from('repartidores')
        .select('id, nombre, estado')
        .eq('ferreteria_id', ferreteriaId)
        .eq('activo', true)
        .eq('estado', 'activo')

      // Ver cuáles están actualmente en ruta
      const { data: enRuta } = await supabase
        .from('entregas')
        .select('repartidor_id')
        .eq('ferreteria_id', ferreteriaId)
        .eq('estado', 'en_ruta')

      const idsEnRuta = new Set((enRuta ?? []).map((e: any) => e.repartidor_id))
      const disponibles = (repartidores ?? []).filter((r: any) => !idsEnRuta.has(r.id))

      return {
        pendientesCount: pendientes.length,
        disponiblesCount: disponibles.length,
        pendientes: pendientes.slice(0, 3).map((p: any) => ({
          id: p.id,
          numero: p.numero_pedido,
          minutosEsperando: Math.round((Date.now() - new Date(p.created_at).getTime()) / 60_000),
        })),
      }
    })

    // ── Paso 3: Si hay repartidores libres y pedidos esperando → alertar dueño
    if (colaInfo.pendientesCount > 0 && colaInfo.disponiblesCount > 0 && motivo !== 'entregado') {
      await step.run('alertar-capacidad-libre', async () => {
        const supabase = adminClient()
        const { data: ferreteria } = await supabase
          .from('ferreterias')
          .select('telefono_dueno, telefono_whatsapp, nombre')
          .eq('id', ferreteriaId)
          .single()

        if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) {
          return { skipped: true }
        }

        const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
        if (!sender) return { skipped: true }

        const motivoLabel = motivo === 'cancelado' ? 'cancelado' : 'retornado'
        const pedidosList = colaInfo.pendientes
          .map((p: { numero: string; minutosEsperando: number }) => `  • ${p.numero} (${p.minutosEsperando} min esperando)`)
          .join('\n')

        await sender.enviarMensaje({
          to: ferreteria.telefono_dueno as string,
          texto: `📦 *Capacidad libre — ${ferreteria.nombre}*\n\nSe ${motivoLabel} un pedido y hay *${colaInfo.disponiblesCount} repartidor(es) disponible(s)*.\n\nPedidos esperando asignación:\n${pedidosList}\n\n👉 Asigna desde el dashboard de Delivery.`,
        })
        return { enviado: true }
      })
    }

    return {
      ferreteriaId,
      motivo,
      pedidoCambio: pedidoId,
      recalculo: resultado,
      cola: colaInfo,
    }
  },
)
