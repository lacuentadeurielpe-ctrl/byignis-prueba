/**
 * Persistencia de la Agenda de entregas. Toda la I/O a la base vive aquí.
 *
 * La ventana canónica está en `entregas`; se espeja en `pedidos` para que las
 * 3 superficies (bot, POS, Ventas) la lean barato (mismo patrón que eta_minutos).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgendaVehiculo, BloqueAgenda, VentanaEntrega } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>

const ESTADOS_TERMINALES = ['entregado', 'cancelado', 'fallida', 'rechazado', 'devuelto']

const SELECT_AGENDA =
  'id, pedido_id, vehiculo_id, estado, ventana_inicio, ventana_fin, ventana_origen, ventana_confirmada, multi_reparto_id, posicion_ruta, pedidos!inner(numero_pedido)'

// ── Helpers de fecha (Lima = UTC-5, sin DST) ──────────────────────────────────

export function limaDayBounds(ref: Date = new Date()): { start: string; end: string; fecha: string } {
  const fecha = ref.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }) // YYYY-MM-DD
  const start = new Date(`${fecha}T00:00:00-05:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString(), fecha }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filaABloque(row: any): BloqueAgenda | null {
  if (!row?.ventana_inicio || !row?.ventana_fin) return null
  const pedido = Array.isArray(row.pedidos) ? row.pedidos[0] : row.pedidos
  return {
    entregaId: row.id,
    pedidoId: row.pedido_id,
    numeroPedido: pedido?.numero_pedido ?? '',
    vehiculoId: row.vehiculo_id ?? null,
    estado: row.estado,
    ventana: {
      inicio: new Date(row.ventana_inicio),
      fin: new Date(row.ventana_fin),
      origen: row.ventana_origen ?? 'base',
      confirmada: !!row.ventana_confirmada,
    },
    viajeId: row.multi_reparto_id ?? null,
    posicion: row.posicion_ruta ?? null,
  }
}

// ── Lecturas ──────────────────────────────────────────────────────────────────

/** Bloques (con ventana) de un vehículo en un día, ordenados por inicio. */
export async function obtenerAgendaVehiculo(
  supabase: DB,
  ferreteriaId: string,
  vehiculoId: string,
  fecha: Date = new Date(),
): Promise<BloqueAgenda[]> {
  const { start, end } = limaDayBounds(fecha)
  const { data, error } = await supabase
    .from('entregas')
    .select(SELECT_AGENDA)
    .eq('ferreteria_id', ferreteriaId)
    .eq('vehiculo_id', vehiculoId)
    .not('ventana_inicio', 'is', null)
    .gte('ventana_inicio', start)
    .lt('ventana_inicio', end)
    .not('estado', 'in', `(${ESTADOS_TERMINALES.join(',')})`)
    .order('ventana_inicio', { ascending: true })

  if (error) {
    console.error('[Agenda] obtenerAgendaVehiculo:', error.message)
    return []
  }
  return (data ?? []).map(filaABloque).filter((b): b is BloqueAgenda => b !== null)
}

/** Agenda del día agrupada por vehículo (para el dueño en Ventas). */
export async function obtenerAgendaDelDia(
  supabase: DB,
  ferreteriaId: string,
  fecha: Date = new Date(),
): Promise<AgendaVehiculo[]> {
  const { start, end, fecha: fechaStr } = limaDayBounds(fecha)
  const { data, error } = await supabase
    .from('entregas')
    .select(SELECT_AGENDA)
    .eq('ferreteria_id', ferreteriaId)
    .not('ventana_inicio', 'is', null)
    .gte('ventana_inicio', start)
    .lt('ventana_inicio', end)
    .not('estado', 'in', `(${ESTADOS_TERMINALES.join(',')})`)
    .order('ventana_inicio', { ascending: true })

  if (error) {
    console.error('[Agenda] obtenerAgendaDelDia:', error.message)
    return []
  }

  const porVehiculo = new Map<string, BloqueAgenda[]>()
  for (const row of data ?? []) {
    const bloque = filaABloque(row)
    if (!bloque) continue
    const key = bloque.vehiculoId ?? 'sin_vehiculo'
    const arr = porVehiculo.get(key) ?? []
    arr.push(bloque)
    porVehiculo.set(key, arr)
  }

  return [...porVehiculo.entries()].map(([vehiculoId, bloques]) => ({
    vehiculoId,
    fecha: fechaStr,
    bloques,
  }))
}

// ── Escrituras ────────────────────────────────────────────────────────────────

/** Escribe la ventana en `entregas` y la espeja en `pedidos`. */
export async function escribirVentana(
  supabase: DB,
  args: { entregaId: string; pedidoId: string; ferreteriaId: string; ventana: VentanaEntrega },
): Promise<void> {
  const { entregaId, pedidoId, ferreteriaId, ventana } = args
  const inicio = ventana.inicio.toISOString()
  const fin = ventana.fin.toISOString()

  await supabase
    .from('entregas')
    .update({
      ventana_inicio: inicio,
      ventana_fin: fin,
      ventana_origen: ventana.origen,
      ventana_confirmada: ventana.confirmada,
    })
    .eq('id', entregaId)
    .eq('ferreteria_id', ferreteriaId)

  await supabase
    .from('pedidos')
    .update({
      ventana_inicio: inicio,
      ventana_fin: fin,
      ventana_confirmada: ventana.confirmada,
    })
    .eq('id', pedidoId)
    .eq('ferreteria_id', ferreteriaId)
}

/** Ajuste manual del repartidor: fija la ventana y la marca confirmada+manual. */
export async function ajustarVentana(
  supabase: DB,
  ferreteriaId: string,
  entregaId: string,
  inicio: Date,
  fin: Date,
): Promise<void> {
  const { data: ent } = await supabase
    .from('entregas')
    .select('pedido_id')
    .eq('id', entregaId)
    .eq('ferreteria_id', ferreteriaId)
    .maybeSingle()
  if (!ent?.pedido_id) return

  await escribirVentana(supabase, {
    entregaId,
    pedidoId: ent.pedido_id as string,
    ferreteriaId,
    ventana: { inicio, fin, origen: 'manual', confirmada: true },
  })
}

/** Confirma la ventana actual (sin cambiar horas): "yo me hago cargo de esta". */
export async function confirmarVentana(
  supabase: DB,
  ferreteriaId: string,
  entregaId: string,
): Promise<void> {
  const { data: ent } = await supabase
    .from('entregas')
    .select('pedido_id, ventana_confirmada')
    .eq('id', entregaId)
    .eq('ferreteria_id', ferreteriaId)
    .maybeSingle()
  if (!ent?.pedido_id) return

  await supabase
    .from('entregas')
    .update({ ventana_confirmada: true })
    .eq('id', entregaId)
    .eq('ferreteria_id', ferreteriaId)

  await supabase
    .from('pedidos')
    .update({ ventana_confirmada: true })
    .eq('id', ent.pedido_id as string)
    .eq('ferreteria_id', ferreteriaId)
}

/** El repartidor actualiza su duración de bloque promedio. */
export async function setDuracionBloqueDefault(
  supabase: DB,
  ferreteriaId: string,
  repartidorId: string,
  minutos: number,
): Promise<void> {
  const min = Math.max(5, Math.min(240, Math.round(minutos)))
  await supabase
    .from('repartidores')
    .update({ duracion_bloque_default_min: min })
    .eq('id', repartidorId)
    .eq('ferreteria_id', ferreteriaId)
}

/**
 * Agrupa entregas en un mismo viaje (multi_reparto): "las latas de arena de
 * camino al cemento". Todas comparten la ventana del viaje (min inicio → max
 * fin) y quedan ancladas (origen agrupada, confirmada). Reutiliza multi_repartos
 * + entregas.multi_reparto_id/posicion_ruta.
 */
export async function agruparEnViaje(
  supabase: DB,
  args: {
    ferreteriaId: string
    repartidorId: string | null
    vehiculoId: string | null
    entregaIds: string[]
  },
): Promise<{ viajeId: string | null }> {
  const { ferreteriaId, repartidorId, vehiculoId, entregaIds } = args
  if (entregaIds.length < 2) return { viajeId: null }

  const { data: entregas } = await supabase
    .from('entregas')
    .select('id, pedido_id, ventana_inicio, ventana_fin')
    .eq('ferreteria_id', ferreteriaId)
    .in('id', entregaIds)

  const filas = (entregas ?? []).filter(
    (e: Record<string, unknown>) => e.ventana_inicio && e.ventana_fin,
  )
  if (filas.length < 2) return { viajeId: null }

  const inicios = filas.map((e: Record<string, unknown>) => new Date(e.ventana_inicio as string).getTime())
  const fines = filas.map((e: Record<string, unknown>) => new Date(e.ventana_fin as string).getTime())
  const tripInicio = new Date(Math.min(...inicios)).toISOString()
  const tripFin = new Date(Math.max(...fines)).toISOString()

  // Crear el viaje
  const { data: viaje, error: errViaje } = await supabase
    .from('multi_repartos')
    .insert({
      ferreteria_id: ferreteriaId,
      repartidor_id: repartidorId,
      vehiculo_id: vehiculoId,
      estado: 'planificado',
    })
    .select('id')
    .single()

  if (errViaje || !viaje?.id) {
    console.error('[Agenda] agruparEnViaje crear viaje:', errViaje?.message)
    return { viajeId: null }
  }
  const viajeId = viaje.id as string

  // Asignar cada entrega al viaje, en el orden recibido, con la ventana del viaje
  let posicion = 1
  for (const entregaId of entregaIds) {
    const fila = filas.find((e: Record<string, unknown>) => e.id === entregaId)
    if (!fila) continue
    await supabase
      .from('entregas')
      .update({
        multi_reparto_id: viajeId,
        posicion_ruta: posicion,
        orden_en_ruta: posicion,
        ventana_inicio: tripInicio,
        ventana_fin: tripFin,
        ventana_origen: 'agrupada',
        ventana_confirmada: true,
      })
      .eq('id', entregaId)
      .eq('ferreteria_id', ferreteriaId)

    await supabase
      .from('pedidos')
      .update({ ventana_inicio: tripInicio, ventana_fin: tripFin, ventana_confirmada: true })
      .eq('id', (fila as Record<string, unknown>).pedido_id as string)
      .eq('ferreteria_id', ferreteriaId)

    posicion++
  }

  return { viajeId }
}

/** Promedio real (min) de las últimas entregas del repartidor: prometido vs real. */
export async function promedioRealReciente(
  supabase: DB,
  ferreteriaId: string,
  repartidorId: string,
  dias = 7,
): Promise<{ promedioMin: number | null; muestras: number }> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('entregas')
    .select('duracion_real_min')
    .eq('ferreteria_id', ferreteriaId)
    .eq('repartidor_id', repartidorId)
    .gte('llego_at', desde)
    .not('duracion_real_min', 'is', null)

  const valores = (data ?? [])
    .map((e: Record<string, unknown>) => Number(e.duracion_real_min))
    .filter((n: number) => Number.isFinite(n) && n > 0)

  if (!valores.length) return { promedioMin: null, muestras: 0 }
  const promedio = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)
  return { promedioMin: promedio, muestras: valores.length }
}
