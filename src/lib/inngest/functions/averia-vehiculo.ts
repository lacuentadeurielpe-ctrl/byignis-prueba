/**
 * Inngest Function: delivery/averia-vehiculo
 *
 * Se dispara cuando se reporta una avería en un vehículo.
 * Orquesta la recuperación completa:
 *   1. Marca el vehículo como en avería en BD
 *   2. Encuentra las entregas afectadas
 *   3. Reasigna a otros vehículos disponibles (o deja en cola)
 *   4. Recalcula todos los ETAs con la nueva situación
 *   5. Notifica al dueño, clientes afectados y repartidor
 *   6. Monitorea hasta que la avería se resuelva
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { resolverSender } from '@/lib/whatsapp/provider'
import { manejarAveriaVehiculo } from '@/lib/delivery/reassignment-engine'
import { recalcularETAsCascada } from '@/lib/delivery/cascade-eta'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnAveriaVehiculo = inngest.createFunction(
  {
    id:      'delivery-averia-vehiculo',
    name:    'Gestionar avería de vehículo',
    retries: 3,
    triggers: [{ event: 'delivery/vehiculo.averia' as string }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const {
      ferreteriaId,
      vehiculoId,
      repartidorId,
      descripcion,
      grave = false,
      tiempoEstimadoMin,   // minutos estimados para reparar
      incidenteId,
    } = event.data

    // ── Paso 1: Marcar avería y reasignar entregas ─────────────────────────────
    const resultado = await step.run('marcar-y-reasignar', async () => {
      const supabase = adminClient()
      return manejarAveriaVehiculo({
        ferreteriaId,
        vehiculoId,
        repartidorId,
        descripcion,
        severidad:              grave ? 'averia_grave' : 'averia_leve',
        estResolucionMinutos:   tiempoEstimadoMin ?? undefined,
        autoReasignar:          grave,
      }, supabase)
    })

    // ── Paso 2: Notificar al dueño ─────────────────────────────────────────────
    await step.run('notificar-dueno', async () => {
      const supabase = adminClient()

      const { data: ferreteria } = await supabase
        .from('ferreterias')
        .select('telefono_dueno, telefono_whatsapp, nombre')
        .eq('id', ferreteriaId).single()

      if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) return

      const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
      if (!sender) return

      const { data: vehiculo } = await supabase
        .from('vehiculos_delivery')
        .select('nombre, placa, tipo')
        .eq('id', vehiculoId).maybeSingle()

      const { data: repartidor } = await supabase
        .from('repartidores')
        .select('nombre')
        .eq('id', repartidorId).maybeSingle()

      const entregasAfectadas = resultado?.entregasReasignadas?.length ?? 0
      const tipoAveria = grave ? '🔴 AVERÍA GRAVE' : '🟡 Avería Leve'
      const eta = tiempoEstimadoMin
        ? `Tiempo estimado de reparación: ~${tiempoEstimadoMin} min`
        : 'Tiempo de reparación: indeterminado'

      await sender.enviarMensaje({
        to:    ferreteria.telefono_dueno as string,
        texto: `${tipoAveria} — ${ferreteria.nombre ?? 'Tu ferretería'}\n\n🚗 Vehículo: ${vehiculo?.nombre ?? vehiculoId} (${vehiculo?.tipo ?? ''})\n${vehiculo?.placa ? `📋 Placa: ${vehiculo.placa}` : ''}\n👤 Repartidor: ${repartidor?.nombre ?? repartidorId}\n\n📝 Descripción: ${descripcion}\n⏱ ${eta}\n\n📦 Entregas afectadas: *${entregasAfectadas}*\n${entregasAfectadas > 0 ? resultado?.requiereAprobacion ? '⚠️ Reasignación pendiente de tu aprobación.' : '✅ Entregas reasignadas automáticamente.' : '✅ No había entregas en ruta.'}`,
      })
    })

    // ── Paso 3: Notificar a clientes afectados (si hay demora significativa) ───
    if ((resultado?.entregasReasignadas?.length ?? 0) > 0) {
      await step.run('notificar-clientes-afectados', async () => {
        const supabase = adminClient()

        const { data: ferreteria } = await supabase
          .from('ferreterias')
          .select('telefono_whatsapp, nombre')
          .eq('id', ferreteriaId).single()

        if (!ferreteria?.telefono_whatsapp) return

        const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
        if (!sender) return

        // Obtener pedidos afectados con teléfono de cliente
        const entregaIds = (resultado.entregasReasignadas ?? []).map((e: Record<string, string>) => e.entregaId)
        if (!entregaIds.length) return

        const { data: pedidosAfectados } = await supabase
          .from('entregas')
          .select('pedido_id, pedidos!inner(numero_pedido, cliente_telefono, eta_minutos)')
          .in('id', entregaIds)

        for (const e of pedidosAfectados ?? []) {
          const p = (Array.isArray(e.pedidos) ? e.pedidos[0] : e.pedidos) as { numero_pedido?: string; cliente_telefono?: string; eta_minutos?: number } | null
          if (!p?.cliente_telefono) continue

          const nuevaEta = tiempoEstimadoMin
            ? `~${(p.eta_minutos as number ?? 30) + tiempoEstimadoMin} min`
            : 'un momento adicional'

          await sender.enviarMensaje({
            to:    (p.cliente_telefono as string).replace(/^\+/, ''),
            texto: `⚠️ *Pequeño retraso en tu entrega*\n\nHola, somos ${ferreteria.nombre ?? 'tu ferretería'}. Tu pedido *${p.numero_pedido ?? ''}* tiene un retraso inesperado.\n\n⏱ Nueva hora estimada: ${nuevaEta}\nEstamos trabajando para resolver esto lo antes posible. ¡Gracias por tu comprensión!`,
          }).catch(() => null) // No bloquear si falla un envío individual
        }
      })
    }

    // ── Paso 4: Recalcular todos los ETAs de la ferretería ────────────────────
    await step.run('recalcular-etas', async () => {
      const supabase = adminClient()
      await recalcularETAsCascada(ferreteriaId, supabase)
    })

    // ── Paso 5: Registrar en log de operaciones ───────────────────────────────
    await step.run('registrar-log', async () => {
      const supabase = adminClient()
      await supabase.from('delivery_operaciones_log').insert({
        ferreteria_id: ferreteriaId,
        tipo_evento:   grave ? 'vehiculo_averia_grave' : 'vehiculo_averia_leve',
        entidad_tipo:  'vehiculo',
        entidad_id:    vehiculoId,
        detalle: {
          descripcion,
          tiempo_estimado_min: tiempoEstimadoMin,
          entregas_afectadas:  resultado?.entregasReasignadas?.length ?? 0,
          incidente_id:        incidenteId,
          reasignadas:         resultado?.entregasReasignadas?.length ?? 0,
        },
        origen:     'inngest',
        resuelto:   false,
      })
    })

    // ── Paso 6: Si hay tiempo estimado, monitorear hasta resolución ───────────
    if (tiempoEstimadoMin && tiempoEstimadoMin > 0) {
      const esperarMs = tiempoEstimadoMin * 60_000 + 5 * 60_000 // +5 min margen
      await step.sleep('esperar-reparacion', esperarMs)

      await step.run('verificar-resolucion', async () => {
        const supabase = adminClient()
        const { data: v } = await supabase
          .from('vehiculos_delivery')
          .select('estado')
          .eq('id', vehiculoId).single()

        if (v?.estado === 'disponible') {
          // Vehículo reparado — recalcular ETAs con flota completa
          await recalcularETAsCascada(ferreteriaId, supabase)

          const { data: ferreteria } = await supabase
            .from('ferreterias')
            .select('telefono_dueno, telefono_whatsapp')
            .eq('id', ferreteriaId).single()

          if (ferreteria?.telefono_dueno && ferreteria?.telefono_whatsapp) {
            const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
            if (sender) {
              await sender.enviarMensaje({
                to:    ferreteria.telefono_dueno as string,
                texto: `✅ El vehículo ya está disponible. ETAs recalculados automáticamente.`,
              }).catch(() => null)
            }
          }
        }
      })
    }

    return {
      completado:          true,
      vehiculoId,
      entregasReasignadas: resultado?.entregasReasignadas?.length ?? 0,
    }
  },
)
