/**
 * Inngest Function: delivery/monitor-demora
 *
 * Monitor activo que verifica periódicamente las entregas en curso.
 * Se dispara con cron cada 15 minutos durante horas hábiles (8am-9pm Lima).
 *
 * Detecta:
 *   - Entregas sin repartidor asignado por más de 20 min
 *   - Entregas en ruta con ETA superado por más del 50%
 *   - Repartidores sin GPS actualizado en más de 30 min
 *   - Pedidos programados sin asignar a 15 min de su hora
 *   - Cola acumulada excesiva sin repartidores disponibles
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'
import { getYCloudApiKey } from '@/lib/tenant'
import { recalcularETAsCascada } from '@/lib/delivery/cascade-eta'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Hora Lima (UTC-5)
function horaLima(): number {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/Lima', hour: 'numeric', hour12: false,
  }) as unknown as number
}

export const fnMonitorDemora = inngest.createFunction(
  {
    id:      'delivery-monitor-demora',
    name:    'Monitor de demoras de delivery',
    retries: 1,
    triggers: [
      { event: 'delivery/monitor.check' as string },
      // Cron: cada 15 min entre 8am y 9pm Lima (UTC-5 = UTC+19/+21 en formato IANA)
      { cron: '*/15 13-24,0-2 * * *' },  // 8am-9pm Lima = 13:00-02:00 UTC
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: { step: any }) => {
    const hora = horaLima()

    // Solo operar en horas hábiles (8am - 9pm Lima)
    if (hora < 8 || hora >= 21) {
      return { skipped: true, motivo: 'fuera de horas hábiles' }
    }

    const supabase = adminClient()

    // Obtener todas las ferreterías activas con delivery habilitado
    const { data: ferreterias } = await supabase
      .from('ferreterias')
      .select('id, nombre, telefono_dueno, telefono_whatsapp')
      .eq('delivery_activo', true)

    if (!ferreterias?.length) return { procesadas: 0 }

    const alertas: Array<{
      ferreteriaId:   string
      nombreFerreteria: string
      tipo:           string
      mensaje:        string
      critico:        boolean
    }> = []

    // ── Verificar cada ferretería ─────────────────────────────────────────────
    for (const ferreteria of ferreterias) {
      const ferreteriaId = ferreteria.id as string

      // ── 1. Entregas sin repartidor hace más de 20 min ─────────────────────
      const hace20min = new Date(Date.now() - 20 * 60_000).toISOString()
      const { data: sinRepartidor } = await supabase
        .from('entregas')
        .select('id, pedidos!inner(numero_pedido)')
        .eq('ferreteria_id', ferreteriaId)
        .eq('estado', 'pendiente')
        .is('repartidor_id', null)
        .lt('created_at', hace20min)

      if (sinRepartidor?.length) {
        alertas.push({
          ferreteriaId,
          nombreFerreteria: ferreteria.nombre as string,
          tipo:    'sin_repartidor',
          mensaje: `⚠️ ${sinRepartidor.length} entrega(s) sin repartidor asignado hace >20 min`,
          critico: (sinRepartidor.length ?? 0) >= 3,
        })
      }

      // ── 2. Entregas en ruta con ETA superado >50% ─────────────────────────
      const { data: enRuta } = await supabase
        .from('entregas')
        .select('id, eta_actual, duracion_estimada_min, salio_at, pedidos!inner(numero_pedido)')
        .eq('ferreteria_id', ferreteriaId)
        .eq('estado', 'en_ruta')
        .not('salio_at', 'is', null)
        .not('eta_actual', 'is', null)

      const demoradas = (enRuta ?? []).filter((e: Record<string, unknown>) => {
        const etaMs = new Date(e.eta_actual as string).getTime()
        const margen = ((e.duracion_estimada_min as number) ?? 30) * 60_000 * 0.5 // 50% de margen
        return Date.now() > etaMs + margen
      })

      if (demoradas.length) {
        alertas.push({
          ferreteriaId,
          nombreFerreteria: ferreteria.nombre as string,
          tipo:    'entrega_demorada',
          mensaje: `⚠️ ${demoradas.length} entrega(s) superaron su ETA en más del 50%`,
          critico: demoradas.length >= 2,
        })
      }

      // ── 3. Repartidores sin GPS en más de 30 min ──────────────────────────
      const hace30min = new Date(Date.now() - 30 * 60_000).toISOString()
      const { data: sinGPS } = await supabase
        .from('repartidores')
        .select('id, nombre')
        .eq('ferreteria_id', ferreteriaId)
        .eq('estado_operativo', 'en_ruta')
        .lt('gps_actualizado_at', hace30min)

      if (sinGPS?.length) {
        alertas.push({
          ferreteriaId,
          nombreFerreteria: ferreteria.nombre as string,
          tipo:    'gps_desactualizado',
          mensaje: `📡 ${sinGPS.length} repartidor(es) en ruta sin GPS en >30 min`,
          critico: false,
        })
      }

      // ── 4. Pedidos programados próximos sin repartidor ────────────────────
      const en15min = new Date(Date.now() + 15 * 60_000).toISOString()
      const { data: programadosSinRep } = await supabase
        .from('delivery_queue')
        .select('id, pedido_id')
        .eq('ferreteria_id', ferreteriaId)
        .eq('estado', 'esperando')
        .eq('prioridad', 5)
        .not('no_antes_de', 'is', null)
        .lt('no_antes_de', en15min)
        .gt('no_antes_de', new Date().toISOString())

      if (programadosSinRep?.length) {
        alertas.push({
          ferreteriaId,
          nombreFerreteria: ferreteria.nombre as string,
          tipo:    'programado_sin_repartidor',
          mensaje: `📅 ${programadosSinRep.length} pedido(s) programado(s) en 15 min sin repartidor`,
          critico: true,
        })
      }

      // ── 5. Cola acumulada sin repartidores ────────────────────────────────
      const { count: colaCount } = await supabase
        .from('delivery_queue')
        .select('id', { count: 'exact', head: true })
        .eq('ferreteria_id', ferreteriaId)
        .eq('estado', 'esperando')

      const { count: disponibles } = await supabase
        .from('repartidores')
        .select('id', { count: 'exact', head: true })
        .eq('ferreteria_id', ferreteriaId)
        .eq('estado_operativo', 'disponible')

      if ((colaCount ?? 0) >= 5 && (disponibles ?? 0) === 0) {
        alertas.push({
          ferreteriaId,
          nombreFerreteria: ferreteria.nombre as string,
          tipo:    'cola_sin_repartidores',
          mensaje: `🚨 ${colaCount} pedidos en cola sin repartidores disponibles`,
          critico: true,
        })
      }
    }

    // ── Recalcular ETAs para ferreterías con problemas ────────────────────────
    const step_recalc = await step.run('recalcular-etas-criticos', async () => {
      const conProblemas = [...new Set(alertas.map(a => a.ferreteriaId))]
      let recalculados = 0
      for (const fId of conProblemas) {
        try {
          await recalcularETAsCascada(fId, adminClient())
          recalculados++
        } catch { /* no bloquear */ }
      }
      return recalculados
    })

    // ── Enviar alertas críticas al dueño ──────────────────────────────────────
    await step.run('enviar-alertas', async () => {
      const supabase = adminClient()

      // Agrupar por ferretería
      const porFerreteria = new Map<string, typeof alertas>()
      for (const a of alertas) {
        if (!porFerreteria.has(a.ferreteriaId)) porFerreteria.set(a.ferreteriaId, [])
        porFerreteria.get(a.ferreteriaId)!.push(a)
      }

      for (const [ferreteriaId, alertasF] of porFerreteria) {
        const hayCriticas = alertasF.some(a => a.critico)
        if (!hayCriticas) continue  // Solo enviar si hay alertas críticas

        const apiKey = await getYCloudApiKey(ferreteriaId).catch(() => null)
        if (!apiKey) continue

        const { data: ferreteria } = await supabase
          .from('ferreterias')
          .select('telefono_dueno, telefono_whatsapp, nombre')
          .eq('id', ferreteriaId).single()

        if (!ferreteria?.telefono_dueno || !ferreteria?.telefono_whatsapp) continue

        const lineasAlertas = alertasF.map(a => a.mensaje).join('\n')

        await enviarMensaje({
          from:  (ferreteria.telefono_whatsapp as string).replace(/^\+/, ''),
          to:    ferreteria.telefono_dueno as string,
          texto: `🔔 *Monitor Delivery — ${ferreteria.nombre ?? ''}*\n${new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}\n\n${lineasAlertas}\n\n_Revisa el dashboard para tomar acción._`,
          apiKey,
        }).catch(() => null)

        // Registrar alertas en log
        for (const alerta of alertasF.filter(a => a.critico)) {
          await supabase.from('delivery_operaciones_log').insert({
            ferreteria_id: ferreteriaId,
            tipo_evento:   alerta.tipo,
            entidad_tipo:  'sistema',
            entidad_id:    null,
            detalle:       { mensaje: alerta.mensaje },
            origen:        'monitor_cron',
            resuelto:      false,
          })
        }
      }
    })

    return {
      procesadas:    ferreterias.length,
      alertasTotal:  alertas.length,
      alertasCriticas: alertas.filter(a => a.critico).length,
      etasRecalculados: step_recalc,
    }
  },
)
