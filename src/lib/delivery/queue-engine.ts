/**
 * Queue Engine — Motor de Cola Inteligente de Delivery
 *
 * Cola persistente en Supabase + scoring multifactor.
 * Maneja: prioridad, ventanas horarias, bloqueos temporales,
 * capacidad de vehículo, reprogramaciones, reintentos.
 *
 * Score más alto = más urgente.
 * tinyqueue para ordenamiento en memoria cuando se necesita
 * comparar múltiples ítems en una sola operación.
 */

import TinyQueue from 'tinyqueue'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ParamsEncolar = {
  ferreteriaId:      string
  pedidoId:          string
  entregaId?:        string | null
  prioridad?:        number
  vehiculoTipoReq?:  string | null
  pesoTotalKg?:      number | null
  zonaDeliveryId?:   string | null
  repartidorPrefId?: string | null
  noAntesDe?:        Date | null
  noDespuesDe?:      Date | null
  notasInternas?:    string
}

export type EstadoCola =
  | 'esperando'
  | 'asignado'
  | 'en_ruta'
  | 'completado'
  | 'fallido'
  | 'reagendado'
  | 'cancelado'

export interface ItemCola {
  id:                string
  ferreteriaId:      string
  pedidoId:          string
  entregaId:         string | null
  prioridad:         number       // 1=urgente … 5=bajo
  score:             number
  estado:            EstadoCola
  vehiculoTipoReq:   string | null
  pesoTotalKg:       number | null
  zonaDeliveryId:    string | null
  noAntesDe:         Date | null   // pedidos programados
  noDespuesDe:       Date | null   // deadline SLA
  bloqueadoHasta:    Date | null
  intentos:          number
  maxIntentos:       number
  reagendadoPara:    Date | null
  reagendadoMotivo:  string | null
  reagendadoVeces:   number
  createdAt:         Date
}

export interface FiltrosAsignacion {
  vehiculoTipo?:       string
  vehiculoCapacidadKg?: number
  zonaDeliveryId?:     string
  soloUrgentes?:       boolean
}

export interface ResultadoEncolar {
  id:       string
  score:    number
  prioridad: number
}

// ── Constantes de prioridad ───────────────────────────────────────────────────

export const PRIORIDAD = {
  URGENTE:    1,   // pedido ya pagado, cliente esperando
  ALTA:       2,   // pedido confirmado reciente
  NORMAL:     3,   // flujo estándar
  BAJA:       4,   // pedido de baja urgencia
  PROGRAMADO: 5,   // pedido programado sin presión inmediata
} as const

// ── Score computation ─────────────────────────────────────────────────────────

function calcularScore(item: {
  prioridad:     number
  createdAt:     Date
  noAntesDe:     Date | null
  noDespuesDe:   Date | null
  intentos:      number
  pesoTotalKg:   number | null
}): number {
  const ahora = Date.now()
  let score = (6 - item.prioridad) * 1000  // base: 1000-5000

  // Antigüedad en cola (hasta +500 por 60+ minutos esperando)
  const antiguedadMin = (ahora - item.createdAt.getTime()) / 60_000
  score += Math.min(antiguedadMin * 8, 500)

  // Urgencia por deadline (no_despues_de)
  if (item.noDespuesDe) {
    const minRestantes = (item.noDespuesDe.getTime() - ahora) / 60_000
    if (minRestantes < 15)      score += 600  // crítico
    else if (minRestantes < 30) score += 300  // urgente
    else if (minRestantes < 60) score += 150  // moderado
  }

  // Urgencia por ventana de pedido programado (no_antes_de)
  if (item.noAntesDe) {
    const minParaVentana = (item.noAntesDe.getTime() - ahora) / 60_000
    if (minParaVentana < 30)       score += 400
    else if (minParaVentana < 60)  score += 200
  }

  // Penalización por reintentos (bajamos prioridad tras fallos)
  score -= item.intentos * 80

  // Leve boost por carga pesada (tomar antes para no demorar)
  if (item.pesoTotalKg && item.pesoTotalKg > 50) score += 30

  return Math.max(score, 0)
}

// ── Encolar pedido ────────────────────────────────────────────────────────────

export async function encolarPedido(
  params: ParamsEncolar,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<ResultadoEncolar> {
  const prioridad = params.prioridad ?? PRIORIDAD.NORMAL
  const createdAt = new Date()

  const score = calcularScore({
    prioridad,
    createdAt,
    noAntesDe:   params.noAntesDe ?? null,
    noDespuesDe: params.noDespuesDe ?? null,
    intentos:    0,
    pesoTotalKg: params.pesoTotalKg ?? null,
  })

  const { data, error } = await supabase
    .from('delivery_queue')
    .upsert({
      ferreteria_id:     params.ferreteriaId,
      pedido_id:         params.pedidoId,
      entrega_id:        params.entregaId ?? null,
      prioridad,
      score,
      estado:            'esperando',
      vehiculo_tipo_req: params.vehiculoTipoReq ?? null,
      peso_total_kg:     params.pesoTotalKg ?? null,
      zona_delivery_id:  params.zonaDeliveryId ?? null,
      no_antes_de:       params.noAntesDe?.toISOString() ?? null,
      no_despues_de:     params.noDespuesDe?.toISOString() ?? null,
      notas_internas:    params.notasInternas ?? null,
      intentos:          0,
    }, {
      onConflict: 'ferreteria_id,pedido_id,estado',
      ignoreDuplicates: false,
    })
    .select('id, score, prioridad')
    .single()

  if (error) throw new Error(`[Queue] Error encolando pedido: ${error.message}`)

  return { id: data.id, score: data.score, prioridad: data.prioridad }
}

// ── Obtener siguiente ítem disponible ─────────────────────────────────────────

/**
 * Devuelve el ítem con mayor score que cumpla los filtros de asignación.
 * Respeta ventanas de tiempo (no_antes_de) y bloqueos temporales.
 */
export async function obtenerSiguienteItem(
  ferreteriaId: string,
  filtros: FiltrosAsignacion,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<ItemCola | null> {
  const ahora = new Date().toISOString()

  let query = supabase
    .from('delivery_queue')
    .select('*')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'esperando')
    .or(`no_antes_de.is.null,no_antes_de.lte.${ahora}`)   // ventana de tiempo
    .or(`bloqueado_hasta.is.null,bloqueado_hasta.lte.${ahora}`)  // no bloqueados
    .lt('intentos', 99)
    .order('score', { ascending: false })
    .limit(20)  // traer top 20 para filtrar en memoria con tinyqueue

  if (filtros.zonaDeliveryId) {
    query = query.or(`zona_delivery_id.is.null,zona_delivery_id.eq.${filtros.zonaDeliveryId}`)
  }

  const { data, error } = await query

  if (error || !data?.length) return null

  // Filtrar por capacidad de vehículo en memoria
  const candidatos = data.filter((item: Record<string, unknown>) => {
    const peso = item.peso_total_kg as number | null
    if (peso && filtros.vehiculoCapacidadKg && peso > filtros.vehiculoCapacidadKg) {
      return false  // vehículo no aguanta el peso
    }
    if (filtros.vehiculoTipo && item.vehiculo_tipo_req) {
      // Si el ítem requiere un tipo específico, verificar coincidencia
      const req = item.vehiculo_tipo_req as string
      if (req !== filtros.vehiculoTipo && req !== 'cualquiera') return false
    }
    return true
  })

  if (!candidatos.length) return null

  // Usar tinyqueue para encontrar el de mayor score si hay empate en prioridad
  const pq = new TinyQueue<Record<string, unknown>>(
    candidatos,
    (a, b) => (b.score as number) - (a.score as number),
  )

  const top = pq.pop()
  if (!top) return null

  return mapRowToItemCola(top)
}

// ── Obtener cola completa ─────────────────────────────────────────────────────

export async function obtenerCola(
  ferreteriaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  soloEsperando = true,
): Promise<ItemCola[]> {
  let query = supabase
    .from('delivery_queue')
    .select('*')
    .eq('ferreteria_id', ferreteriaId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })

  if (soloEsperando) {
    query = query.eq('estado', 'esperando')
  }

  const { data, error } = await query
  if (error || !data) return []

  return data.map(mapRowToItemCola)
}

// ── Actualizar estado de ítem ─────────────────────────────────────────────────

export async function actualizarEstadoCola(
  itemId:      string,
  nuevoEstado: EstadoCola,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:    SupabaseClient<any>,
  extra?: {
    entregaId?: string
    bloqueadoHasta?: Date
    reagendadoPara?: Date
    reagendadoMotivo?: string
  },
): Promise<void> {
  const patch: Record<string, unknown> = { estado: nuevoEstado, updated_at: new Date().toISOString() }

  if (extra?.entregaId)        patch.entrega_id        = extra.entregaId
  if (extra?.bloqueadoHasta)   patch.bloqueado_hasta   = extra.bloqueadoHasta.toISOString()
  if (extra?.reagendadoPara)   patch.reagendado_para   = extra.reagendadoPara.toISOString()
  if (extra?.reagendadoMotivo) patch.reagendado_motivo = extra.reagendadoMotivo

  if (nuevoEstado === 'reagendado' && extra?.reagendadoPara) {
    patch.estado = 'esperando'  // vuelve a la cola con nueva ventana
    patch.no_antes_de = extra.reagendadoPara.toISOString()
    patch.reagendado_veces = supabase.rpc  // incrementar veces (se hace via SQL)
  }

  await supabase.from('delivery_queue').update(patch).eq('id', itemId)
}

// ── Incrementar intentos (tras fallo de entrega) ──────────────────────────────

export async function incrementarIntentos(
  pedidoId:      string,
  ferreteriaId:  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:      SupabaseClient<any>,
  bloqueadoMin = 30,  // bloquear por N minutos antes de reintentar
): Promise<{ agotado: boolean }> {
  const { data } = await supabase
    .from('delivery_queue')
    .select('id, intentos, max_intentos, reagendado_veces')
    .eq('pedido_id', pedidoId)
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'esperando')
    .maybeSingle()

  if (!data) return { agotado: false }

  const nuevosIntentos = (data.intentos as number) + 1
  const maxIntentos    = data.max_intentos as number
  const agotado        = nuevosIntentos >= maxIntentos

  const bloqueadoHasta = new Date(Date.now() + bloqueadoMin * 60_000)

  await supabase
    .from('delivery_queue')
    .update({
      intentos:        nuevosIntentos,
      estado:          agotado ? 'fallido' : 'esperando',
      bloqueado_hasta: agotado ? null : bloqueadoHasta.toISOString(),
      score: calcularScore({
        prioridad:   3,
        createdAt:   new Date(),
        noAntesDe:   null,
        noDespuesDe: null,
        intentos:    nuevosIntentos,
        pesoTotalKg: null,
      }),
    })
    .eq('id', data.id)

  return { agotado }
}

// ── Reprogramar pedido ────────────────────────────────────────────────────────

/**
 * Reprograma un pedido para una fecha/hora futura.
 * Guarda historial en delivery_reprogramaciones.
 * Actualiza la cola con la nueva ventana de tiempo.
 */
export async function reprogramarPedido(
  params: {
    ferreteriaId:   string
    pedidoId:       string
    entregaId?:     string | null
    fechaNueva:     Date
    motivo:         string
    origen:         'sistema' | 'dueno' | 'cliente'
    notificarCliente?: boolean
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  // 1. Obtener fecha original del pedido en cola
  const { data: qItem } = await supabase
    .from('delivery_queue')
    .select('id, no_antes_de, reagendado_veces, score')
    .eq('pedido_id', params.pedidoId)
    .eq('ferreteria_id', params.ferreteriaId)
    .not('estado', 'in', '("completado","cancelado")')
    .maybeSingle()

  const fechaOriginal = qItem?.no_antes_de ? new Date(qItem.no_antes_de as string) : new Date()
  const vecesActual   = (qItem?.reagendado_veces as number) ?? 0

  // 2. Registrar en historial de reprogramaciones
  await supabase.from('delivery_reprogramaciones').insert({
    ferreteria_id:        params.ferreteriaId,
    pedido_id:            params.pedidoId,
    entrega_id:           params.entregaId ?? null,
    fecha_original:       fechaOriginal.toISOString(),
    fecha_nueva:          params.fechaNueva.toISOString(),
    motivo:               params.motivo,
    origen:               params.origen,
    notificado_cliente:   params.notificarCliente ?? false,
  })

  // 3. Actualizar pedido con reprogramación
  await supabase.from('pedidos').update({
    reprogramado_para:   params.fechaNueva.toISOString(),
    reprogramado_motivo: params.motivo,
    reprogramado_veces:  vecesActual + 1,
    reprogramado_at:     new Date().toISOString(),
  }).eq('id', params.pedidoId).eq('ferreteria_id', params.ferreteriaId)

  // 4. Actualizar cola — vuelve a estado esperando con nueva ventana
  if (qItem) {
    const nuevoScore = calcularScore({
      prioridad:   PRIORIDAD.PROGRAMADO,
      createdAt:   new Date(),
      noAntesDe:   params.fechaNueva,
      noDespuesDe: null,
      intentos:    0,
      pesoTotalKg: null,
    })

    await supabase.from('delivery_queue').update({
      estado:            'esperando',
      no_antes_de:       params.fechaNueva.toISOString(),
      bloqueado_hasta:   null,
      intentos:          0,
      reagendado_para:   params.fechaNueva.toISOString(),
      reagendado_motivo: params.motivo,
      reagendado_veces:  vecesActual + 1,
      score:             nuevoScore,
    }).eq('id', qItem.id)
  } else {
    // Si no estaba en cola, crearla
    await encolarPedido({
      ferreteriaId:  params.ferreteriaId,
      pedidoId:      params.pedidoId,
      entregaId:     params.entregaId,
      prioridad:     PRIORIDAD.PROGRAMADO,
      noAntesDe:     params.fechaNueva,
      notasInternas: `Reprogramado: ${params.motivo}`,
    }, supabase)
  }

  // 5. Actualizar entrega si existe
  if (params.entregaId) {
    await supabase.from('entregas').update({
      reagendado_para:   params.fechaNueva.toISOString(),
      reagendado_motivo: params.motivo,
      estado:            'pendiente',
    }).eq('id', params.entregaId).eq('ferreteria_id', params.ferreteriaId)
  }
}

// ── Recalcular scores de toda la cola ─────────────────────────────────────────

/**
 * Recalcula los scores de todos los ítems en espera.
 * Llamar periódicamente (ej. cada 5 min via cron) para que la antigüedad
 * vaya subiendo el score de ítems que llevan mucho tiempo esperando.
 */
export async function recalcularScoresCola(
  ferreteriaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<number> {
  const { data } = await supabase
    .from('delivery_queue')
    .select('id, prioridad, created_at, no_antes_de, no_despues_de, intentos, peso_total_kg')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'esperando')

  if (!data?.length) return 0

  let actualizados = 0
  await Promise.all(
    data.map(async (item: Record<string, unknown>) => {
      const nuevoScore = calcularScore({
        prioridad:   item.prioridad as number,
        createdAt:   new Date(item.created_at as string),
        noAntesDe:   item.no_antes_de ? new Date(item.no_antes_de as string) : null,
        noDespuesDe: item.no_despues_de ? new Date(item.no_despues_de as string) : null,
        intentos:    item.intentos as number,
        pesoTotalKg: item.peso_total_kg as number | null,
      })

      const { error } = await supabase
        .from('delivery_queue')
        .update({ score: nuevoScore })
        .eq('id', item.id)

      if (!error) actualizados++
    }),
  )

  return actualizados
}

// ── Liberar ítem al cancelar pedido ──────────────────────────────────────────

export async function cancelarEnCola(
  pedidoId:     string,
  ferreteriaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:     SupabaseClient<any>,
): Promise<void> {
  await supabase
    .from('delivery_queue')
    .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
    .eq('pedido_id', pedidoId)
    .eq('ferreteria_id', ferreteriaId)
    .not('estado', 'in', '("completado","cancelado")')
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRowToItemCola(row: Record<string, unknown>): ItemCola {
  return {
    id:               row.id as string,
    ferreteriaId:     row.ferreteria_id as string,
    pedidoId:         row.pedido_id as string,
    entregaId:        row.entrega_id as string | null,
    prioridad:        row.prioridad as number,
    score:            row.score as number,
    estado:           row.estado as EstadoCola,
    vehiculoTipoReq:  row.vehiculo_tipo_req as string | null,
    pesoTotalKg:      row.peso_total_kg as number | null,
    zonaDeliveryId:   row.zona_delivery_id as string | null,
    noAntesDe:        row.no_antes_de ? new Date(row.no_antes_de as string) : null,
    noDespuesDe:      row.no_despues_de ? new Date(row.no_despues_de as string) : null,
    bloqueadoHasta:   row.bloqueado_hasta ? new Date(row.bloqueado_hasta as string) : null,
    intentos:         row.intentos as number,
    maxIntentos:      row.max_intentos as number,
    reagendadoPara:   row.reagendado_para ? new Date(row.reagendado_para as string) : null,
    reagendadoMotivo: row.reagendado_motivo as string | null,
    reagendadoVeces:  row.reagendado_veces as number,
    createdAt:        new Date(row.created_at as string),
  }
}
