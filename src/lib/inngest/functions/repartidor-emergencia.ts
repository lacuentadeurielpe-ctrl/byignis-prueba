/**
 * Inngest Function: delivery/repartidor-emergencia
 *
 * Se dispara cuando un repartidor reporta una emergencia personal
 * o queda no disponible (enfermedad, accidente, etc.).
 * Orquesta la reasignación completa de su carga de trabajo.
 *
 * Flujo:
 *   1. Marcar repartidor como no disponible
 *   2. Obtener todas sus entregas activas
 *   3. Reasignar a otros repartidores disponibles
 *   4. Recalcular ETAs
 *   5. Notificar al dueño con resumen
 *   6. Si no hay repartidores: escalar urgentemente
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { resolverSender } from '@/lib/whatsapp/provider'
import { manejarRepartidorNoDisponible } from '@/lib/delivery/reassignment-engine'
import { recalcularETAsCascada } from '@/lib/delivery/cascade-eta'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnRepartidorEmergencia = inngest.createFunction(
  {
    id:      'delivery-repartidor-emergencia',
    name:    'Gestionar emergencia de repartidor',
    retries: 3,
    triggers: [{ event: 'delivery/repartidor.emergencia' as string }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const {
      ferreteriaId,
      repartidorId,
      motivo,
      tiempoEstimadoMin,
      autoReasignar = true,
    } = event.data

    // ── Paso 1: Marcar no disponible y reasignar ──────────────────────────────
    const resultado = await step.run('marcar-y-reasignar', async () => {
      const supabase = adminClient()
      return manejarRepartidorNoDisponible({
        ferreteriaId,
        repartidorId,
        descripcion:  motivo,
        autoReasignar,
        nuevoEstado: 'emergencia',
      }, supabase)
    })

    const entregasReasignadas   = resultado?.reasignaciones?.length ?? 0
    const entregasEnCola        = resultado?.enColaParaReasignar ?? 0
    const requiereAprobacion    = resultado?.requiereAprobacion ?? false

    // ── Paso 2: Recalcular ETAs con la nueva situación ────────────────────────
    await step.run('recalcular-etas', async () => {
      const supabase = adminClient()
      await recalcularETAsCascada(ferreteriaId, supabase)
    })

    // ── Paso 3: Notificar al dueño ────────────────────────────────────────────
    await step.run('notificar-dueno', async () => {
      const supabase = adminClient()

      const { data: ferreteria } = await supabase
        .from('ferreterias')
        .select('telefono_dueno, telefono_whatsapp, nombre')
        .eq('id', ferreteriaId).single()

      if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) return

      const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
      if (!sender) return

      const { data: repartidor } = await supabase
        .from('repartidores')
        .select('nombre')
        .eq('id', repartidorId).maybeSingle()

      const retornoTexto = tiempoEstimadoMin
        ? `⏱ Regresa en aproximadamente ${tiempoEstimadoMin} min`
        : '⏱ Tiempo de regreso: indeterminado'

      const reasigTexto = requiereAprobacion
        ? `⚠️ ${entregasEnCola} entregas esperan tu aprobación manual en el dashboard.`
        : entregasReasignadas > 0
          ? `✅ ${entregasReasignadas} entregas reasignadas automáticamente.`
          : '📭 No tenía entregas activas.'

      await sender.enviarMensaje({
        to:    ferreteria.telefono_dueno as string,
        texto: `🚨 *Emergencia de repartidor — ${ferreteria.nombre ?? 'Tu ferretería'}*\n\n👤 Repartidor: ${repartidor?.nombre ?? repartidorId}\n📝 Motivo: ${motivo}\n${retornoTexto}\n\n${reasigTexto}`,
      })
    })

    // ── Paso 4: Registrar en log de operaciones ───────────────────────────────
    await step.run('registrar-log', async () => {
      const supabase = adminClient()
      await supabase.from('delivery_operaciones_log').insert({
        ferreteria_id: ferreteriaId,
        tipo_evento:   'repartidor_emergencia',
        entidad_tipo:  'repartidor',
        entidad_id:    repartidorId,
        detalle: {
          motivo,
          tiempo_estimado_min:  tiempoEstimadoMin,
          entregas_reasignadas: entregasReasignadas,
          en_cola:              entregasEnCola,
          requiere_aprobacion:  requiereAprobacion,
        },
        origen:   'inngest',
        resuelto: false,
      })
    })

    // ── Paso 5: Si hay tiempo estimado, monitorear retorno ────────────────────
    if (tiempoEstimadoMin && tiempoEstimadoMin > 0) {
      const esperarMs = tiempoEstimadoMin * 60_000 + 5 * 60_000
      await step.sleep('esperar-retorno', esperarMs)

      await step.run('verificar-retorno', async () => {
        const supabase = adminClient()
        const { data: rep } = await supabase
          .from('repartidores')
          .select('estado_operativo')
          .eq('id', repartidorId).single()

        if (rep?.estado_operativo !== 'emergencia') {
          // El repartidor ya está disponible — recalcular ETAs
          await recalcularETAsCascada(ferreteriaId, supabase)
        } else {
          // Sigue en emergencia → volver a alertar al dueño
          const { data: ferreteria } = await supabase
            .from('ferreterias')
            .select('telefono_dueno, telefono_whatsapp')
            .eq('id', ferreteriaId).single()

          if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) return

          const sender = await resolverSender(supabase, ferreteriaId, (ferreteria.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
          if (!sender) return

          await sender.enviarMensaje({
            to:    ferreteria.telefono_dueno as string,
            texto: `⚠️ El repartidor aún no está disponible. Verifica su estado manualmente desde el dashboard.`,
          }).catch(() => null)
        }
      })
    }

    return {
      completado:          true,
      repartidorId,
      entregasReasignadas,
      requiereAprobacion,
    }
  },
)
