/**
 * Inngest Function: delivery/pedido-cancelado-reasignar
 *
 * Se dispara cuando se cancela un pedido que estaba en cola o en ruta.
 * Libera el slot del repartidor y verifica si hay pedidos en cola que
 * pueden ser adelantados.
 *
 * Flujo:
 *   1. Verificar qué repartidor quedó libre
 *   2. Obtener el siguiente pedido de la cola (por score)
 *   3. Si hay pedido con repartidor disponible → asignar inmediatamente
 *   4. Si era multi-stop → eliminar parada y reoptimizar ruta
 *   5. Recalcular ETAs de todos los pedidos activos
 *   6. Notificar si hay cambios relevantes
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'
import { getYCloudApiKey } from '@/lib/tenant'
import { obtenerSiguienteItem, actualizarEstadoCola, cancelarEnCola } from '@/lib/delivery/queue-engine'
import { crearEntrega } from '@/lib/delivery/assignment'
import { eliminarParada } from '@/lib/delivery/multi-stop'
import { recalcularETAsCascada } from '@/lib/delivery/cascade-eta'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnPedidoCanceladoReasignar = inngest.createFunction(
  {
    id:      'delivery-pedido-cancelado-reasignar',
    name:    'Liberar slot y adelantar cola tras cancelación',
    retries: 2,
    triggers: [{ event: 'delivery/pedido.cancelado' as string }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const {
      ferreteriaId,
      pedidoId,
      entregaId,
      repartidorId,
      motivo = 'cancelado_por_cliente',
    } = event.data

    // ── Paso 1: Cancelar en cola y limpiar datos ──────────────────────────────
    await step.run('cancelar-en-cola', async () => {
      const supabase = adminClient()

      // Cancelar en delivery_queue
      await cancelarEnCola(pedidoId, ferreteriaId, supabase)

      // Marcar entrega como cancelada
      if (entregaId) {
        await supabase.from('entregas')
          .update({ estado: 'cancelada' })
          .eq('id', entregaId)
          .eq('ferreteria_id', ferreteriaId)
      }

      // Actualizar pedido
      await supabase.from('pedidos')
        .update({ estado: 'cancelado' })
        .eq('id', pedidoId)
        .eq('ferreteria_id', ferreteriaId)
    })

    // ── Paso 2: Si era parte de un multi-stop, reoptimizar ruta ─────────────
    if (entregaId) {
      const multiRepartoId = await step.run('verificar-multi-stop', async () => {
        const supabase = adminClient()
        const { data: entrega } = await supabase
          .from('entregas')
          .select('multi_reparto_id, repartidores!inner(ultima_lat, ultima_lng)')
          .eq('id', entregaId).single()
        return {
          multiRepartoId: entrega?.multi_reparto_id as string | null,
          repartidorLat:  ((Array.isArray(entrega?.repartidores) ? entrega!.repartidores[0] : entrega?.repartidores) as { ultima_lat?: number | null } | null)?.ultima_lat ?? null,
          repartidorLng:  ((Array.isArray(entrega?.repartidores) ? entrega!.repartidores[0] : entrega?.repartidores) as { ultima_lng?: number | null } | null)?.ultima_lng ?? null,
        }
      })

      if (multiRepartoId?.multiRepartoId) {
        await step.run('eliminar-parada-multi-stop', async () => {
          const supabase = adminClient()

          const { data: ferreteria } = await supabase
            .from('ferreterias')
            .select('lat, lng')
            .eq('id', ferreteriaId).single()

          await eliminarParada(
            multiRepartoId.multiRepartoId!,
            entregaId,
            ferreteriaId,
            ferreteria?.lat  as number ?? 0,
            ferreteria?.lng  as number ?? 0,
            supabase,
            multiRepartoId.repartidorLat  ?? undefined,
            multiRepartoId.repartidorLng  ?? undefined,
          )
        })
      }
    }

    // ── Paso 3: Liberar repartidor si estaba solo en esta entrega ────────────
    if (repartidorId) {
      await step.run('liberar-repartidor', async () => {
        const supabase = adminClient()

        // Contar entregas activas restantes del repartidor
        const { count } = await supabase
          .from('entregas')
          .select('id', { count: 'exact', head: true })
          .eq('repartidor_id', repartidorId)
          .eq('ferreteria_id', ferreteriaId)
          .in('estado', ['pendiente', 'carga', 'en_ruta'])
          .neq('pedido_id', pedidoId)

        if ((count ?? 0) === 0) {
          // Sin más entregas → repartidor disponible
          await supabase.from('repartidores')
            .update({ estado_operativo: 'disponible' })
            .eq('id', repartidorId)
            .eq('ferreteria_id', ferreteriaId)
        }
      })
    }

    // ── Paso 4: Obtener siguiente pedido de la cola ──────────────────────────
    const siguienteItem = await step.run('obtener-siguiente-cola', async () => {
      const supabase = adminClient()
      return obtenerSiguienteItem(ferreteriaId, {}, supabase)
    })

    // ── Paso 5: Si hay siguiente pedido y repartidor libre, asignar ──────────
    if (siguienteItem && repartidorId) {
      await step.run('asignar-siguiente-pedido', async () => {
        const supabase = adminClient()

        // Verificar que el repartidor está disponible
        const { data: rep } = await supabase
          .from('repartidores')
          .select('estado_operativo')
          .eq('id', repartidorId)
          .eq('ferreteria_id', ferreteriaId)
          .single()

        if (rep?.estado_operativo !== 'disponible') return

        // Crear entrega para el siguiente pedido
        await crearEntrega({
          ferreteriaId,
          pedidoId:    siguienteItem.pedidoId,
          repartidorId,
          etaMinutos:  null,  // cascade-eta lo calculará
          prioridad:   siguienteItem.prioridad as 1 | 2 | 3 | 4 | 5,
          pesoTotalKg: siguienteItem.pesoTotalKg ?? 0,
          supabase,
        })

        // Marcar en cola como asignado
        await actualizarEstadoCola(siguienteItem.id, 'asignado', supabase)
      })
    }

    // ── Paso 6: Recalcular todos los ETAs ────────────────────────────────────
    await step.run('recalcular-etas', async () => {
      const supabase = adminClient()
      await recalcularETAsCascada(ferreteriaId, supabase)
    })

    // ── Paso 7: Registrar en log ──────────────────────────────────────────────
    await step.run('registrar-log', async () => {
      const supabase = adminClient()
      await supabase.from('delivery_operaciones_log').insert({
        ferreteria_id: ferreteriaId,
        tipo_evento:   'pedido_cancelado',
        entidad_tipo:  'pedido',
        entidad_id:    pedidoId,
        detalle: {
          motivo,
          entrega_id:       entregaId,
          repartidor_id:    repartidorId,
          siguiente_pedido: siguienteItem?.pedidoId ?? null,
        },
        origen:   'inngest',
        resuelto: true,
      })
    })

    return {
      completado:        true,
      pedidoCancelado:   pedidoId,
      siguienteAsignado: siguienteItem?.pedidoId ?? null,
    }
  },
)
