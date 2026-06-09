/**
 * Reassignment Engine — Motor de reasignación automática
 *
 * Cuando un evento rompe el plan (avería, emergencia, cliente ausente,
 * cancelación en ruta), este motor:
 *   1. Identifica las entregas afectadas
 *   2. Filtra repartidores candidatos (disponibles, vehículo OK, peso OK)
 *   3. Usa OSRM /table para encontrar el más cercano
 *   4. Reasigna y notifica (o escala al dueño si no hay candidatos)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularMatriz, type Coords } from './osrm'
import { recalcularETAsCascada } from './cascade-eta'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MotivoReasignacion =
  | 'averia_vehiculo'
  | 'averia_leve'
  | 'repartidor_emergencia'
  | 'repartidor_no_disponible'
  | 'cliente_ausente'
  | 'cancelacion_en_ruta'
  | 'zona_bloqueada'
  | 'sobrecarga_capacidad'
  | 'manual_dueno'

export interface CandidatoReasignacion {
  repartidorId:  string
  nombre:        string
  vehiculoId:    string | null
  vehiculoTipo:  string | null
  capacidadKg:   number
  velocidadKmh:  number
  lat:           number | null
  lng:           number | null
  entregasActivas: number
  distanciaKm:   number
  duracionMin:   number
  score:         number  // mayor = mejor candidato
}

export interface ResultadoReasignacion {
  exito:         boolean
  candidato:     CandidatoReasignacion | null
  entregasReasignadas: string[]
  requiereAprobacion:  boolean  // true = escalar al dueño
  motivo:        string
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Reasigna las entregas afectadas por un evento.
 * Si `autoAprobar=false` (default), solo propone y escala al dueño.
 * Si `autoAprobar=true`, ejecuta la reasignación directamente.
 */
export async function reasignarEntregas(
  params: {
    ferreteriaId:     string
    entregasIds:      string[]     // IDs de entregas a reasignar
    motivo:           MotivoReasignacion
    repartidorExcluirId?: string  // el que causó el evento (no reasignarle)
    vehiculoExcluirId?:   string
    pesoTotalKg?:     number
    clienteCoords?:   Coords
    autoAprobar?:     boolean
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<ResultadoReasignacion> {
  const { ferreteriaId, entregasIds, motivo } = params

  if (!entregasIds.length) {
    return { exito: false, candidato: null, entregasReasignadas: [], requiereAprobacion: false, motivo: 'Sin entregas que reasignar' }
  }

  // 1. Obtener datos de las entregas afectadas
  const { data: entregas } = await supabase
    .from('entregas')
    .select('id, pedido_id, repartidor_id, vehiculo_id, direccion_entrega')
    .in('id', entregasIds)
    .eq('ferreteria_id', ferreteriaId)

  if (!entregas?.length) {
    return { exito: false, candidato: null, entregasReasignadas: [], requiereAprobacion: false, motivo: 'Entregas no encontradas' }
  }

  // 2. Obtener candidatos disponibles
  const candidatos = await obtenerCandidatos(ferreteriaId, {
    repartidorExcluirId: params.repartidorExcluirId,
    vehiculoExcluirId:   params.vehiculoExcluirId,
    pesoTotalKg:         params.pesoTotalKg,
    clienteCoords:       params.clienteCoords,
  }, supabase)

  if (!candidatos.length) {
    // Sin candidatos — escalar al dueño
    await registrarOperacion(ferreteriaId, 'escalacion_dueno', {
      motivo,
      entregasIds,
      descripcion: 'No hay repartidores disponibles para reasignación',
    }, supabase)

    return {
      exito:              false,
      candidato:          null,
      entregasReasignadas: [],
      requiereAprobacion: true,
      motivo:             'No hay repartidores disponibles — se notificó al encargado',
    }
  }

  // 3. El mejor candidato (mayor score)
  const mejor = candidatos[0]

  if (!params.autoAprobar) {
    // Solo registrar la propuesta, escalar al dueño para aprobación
    await registrarOperacion(ferreteriaId, 'reasignacion_auto', {
      motivo,
      entregasIds,
      candidatoId:   mejor.repartidorId,
      candidatoNombre: mejor.nombre,
      pendienteAprobacion: true,
    }, supabase)

    return {
      exito:              false,
      candidato:          mejor,
      entregasReasignadas: [],
      requiereAprobacion:  true,
      motivo:             `Se propone reasignar a ${mejor.nombre} (${mejor.duracionMin} min de llegada)`,
    }
  }

  // 4. Ejecutar reasignación
  const reasignadas: string[] = []

  for (const entrega of entregas as Record<string, unknown>[]) {
    const { error } = await supabase
      .from('entregas')
      .update({
        repartidor_id: mejor.repartidorId,
        vehiculo_id:   mejor.vehiculoId,
        estado:        'asignado',
        updated_at:    new Date().toISOString(),
      })
      .eq('id', entrega.id as string)
      .eq('ferreteria_id', ferreteriaId)

    if (!error) reasignadas.push(entrega.id as string)
  }

  if (reasignadas.length > 0) {
    // Actualizar estado del repartidor nuevo
    await supabase
      .from('repartidores')
      .update({ estado_operativo: 'en_ruta' })
      .eq('id', mejor.repartidorId)
      .eq('ferreteria_id', ferreteriaId)

    await registrarOperacion(ferreteriaId, 'reasignacion_auto', {
      motivo,
      entregasReasignadas: reasignadas,
      repartidorAnterior:  params.repartidorExcluirId,
      repartidorNuevo:     mejor.repartidorId,
      nombreNuevo:         mejor.nombre,
    }, supabase)

    // Recalcular ETAs en cascada tras reasignación
    await recalcularETAsCascada(ferreteriaId, supabase)
  }

  return {
    exito:               reasignadas.length > 0,
    candidato:           mejor,
    entregasReasignadas: reasignadas,
    requiereAprobacion:  false,
    motivo:              `Reasignado a ${mejor.nombre}`,
  }
}

// ── Obtener candidatos ────────────────────────────────────────────────────────

async function obtenerCandidatos(
  ferreteriaId: string,
  filtros: {
    repartidorExcluirId?: string
    vehiculoExcluirId?:   string
    pesoTotalKg?:         number
    clienteCoords?:       Coords
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<CandidatoReasignacion[]> {
  // Traer repartidores activos disponibles con su vehículo
  let query = supabase
    .from('repartidores')
    .select(`
      id, nombre, ultima_lat, ultima_lng,
      vehiculo_actual_id,
      vehiculos_delivery!vehiculo_actual_id (
        id, tipo, capacidad_kg, velocidad_kmh, estado
      )
    `)
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'activo')
    .in('estado_operativo', ['disponible', 'entre_paradas'])

  if (filtros.repartidorExcluirId) {
    query = query.neq('id', filtros.repartidorExcluirId)
  }

  const { data: repartidores } = await query

  if (!repartidores?.length) return []

  // Filtrar por vehículo disponible y capacidad
  const candidatosFiltrados = (repartidores as Record<string, unknown>[]).filter(r => {
    const v = r.vehiculos_delivery as Record<string, unknown> | null
    if (!v) return false
    if (filtros.vehiculoExcluirId && v.id === filtros.vehiculoExcluirId) return false
    if (!['disponible', 'en_uso'].includes(v.estado as string)) return false
    if (filtros.pesoTotalKg && (v.capacidad_kg as number) < filtros.pesoTotalKg) return false
    return true
  })

  if (!candidatosFiltrados.length) return []

  // Contar entregas activas por repartidor
  const entregasActivasMap = new Map<string, number>()
  await Promise.all(candidatosFiltrados.map(async r => {
    const { count } = await supabase
      .from('entregas')
      .select('id', { count: 'exact', head: true })
      .eq('repartidor_id', r.id as string)
      .eq('ferreteria_id', ferreteriaId)
      .in('estado', ['asignado', 'en_ruta', 'pendiente'])

    entregasActivasMap.set(r.id as string, count ?? 0)
  }))

  // Calcular distancias con OSRM si hay coordenadas del cliente
  let distanciasMap = new Map<string, { km: number; min: number }>()

  if (filtros.clienteCoords) {
    const repsConCoords = candidatosFiltrados.filter(r => r.ultima_lat && r.ultima_lng)

    if (repsConCoords.length > 0) {
      const puntos: Coords[] = [
        filtros.clienteCoords,
        ...repsConCoords.map(r => ({ lat: r.ultima_lat as number, lng: r.ultima_lng as number })),
      ]

      try {
        const matriz = await calcularMatriz(puntos)
        repsConCoords.forEach((r, i) => {
          distanciasMap.set(r.id as string, {
            km:  matriz.distancias[i + 1]?.[0] ?? 99,
            min: matriz.duraciones[i + 1]?.[0] ?? 60,
          })
        })
      } catch {
        // Fallback: distancia estimada de 5km, 15min
        repsConCoords.forEach(r => distanciasMap.set(r.id as string, { km: 5, min: 15 }))
      }
    }
  }

  // Construir candidatos con score
  const candidatos: CandidatoReasignacion[] = candidatosFiltrados.map(r => {
    const v            = r.vehiculos_delivery as Record<string, unknown> | null
    const dist         = distanciasMap.get(r.id as string) ?? { km: 5, min: 15 }
    const entregasAct  = entregasActivasMap.get(r.id as string) ?? 0
    const velocidadKmh = (v?.velocidad_kmh as number) ?? 30
    const capacidadKg  = (v?.capacidad_kg  as number) ?? 150

    // Score: menos tiempo + menos carga = mejor
    const score = 1000 - (dist.min * 5) - (entregasAct * 100)

    return {
      repartidorId:    r.id as string,
      nombre:          r.nombre as string,
      vehiculoId:      v ? (v.id as string) : null,
      vehiculoTipo:    v ? (v.tipo as string) : null,
      capacidadKg,
      velocidadKmh,
      lat:             r.ultima_lat as number | null,
      lng:             r.ultima_lng as number | null,
      entregasActivas: entregasAct,
      distanciaKm:     dist.km,
      duracionMin:     dist.min,
      score,
    }
  })

  // Ordenar por score descendente
  return candidatos.sort((a, b) => b.score - a.score)
}

// ── Manejar repartidor no disponible ─────────────────────────────────────────

/**
 * El repartidor entra a estado no_disponible/averia/emergencia.
 * Sus entregas pendientes vuelven a la cola para reasignación.
 */
export async function manejarRepartidorNoDisponible(
  params: {
    ferreteriaId:   string
    repartidorId:   string
    nuevoEstado:    'averia' | 'emergencia' | 'no_disponible' | 'pausa'
    descripcion?:   string
    autoReasignar?: boolean
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<ResultadoReasignacion> {
  // 1. Actualizar estado del repartidor
  await supabase
    .from('repartidores')
    .update({
      estado_operativo: params.nuevoEstado,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', params.repartidorId)
    .eq('ferreteria_id', params.ferreteriaId)

  // 2. Obtener entregas activas de este repartidor
  const { data: entregas } = await supabase
    .from('entregas')
    .select('id, pedido_id, vehiculo_id')
    .eq('repartidor_id', params.repartidorId)
    .eq('ferreteria_id', params.ferreteriaId)
    .in('estado', ['asignado', 'en_ruta', 'pendiente'])

  if (!entregas?.length) {
    return { exito: true, candidato: null, entregasReasignadas: [], requiereAprobacion: false, motivo: 'Sin entregas activas' }
  }

  const entregasIds = (entregas as Record<string, unknown>[]).map(e => e.id as string)

  // 3. Registrar el evento
  await registrarOperacion(params.ferreteriaId, 'repartidor_emergencia', {
    repartidorId:    params.repartidorId,
    nuevoEstado:     params.nuevoEstado,
    descripcion:     params.descripcion,
    entregasAfectadas: entregasIds,
  }, supabase)

  // 4. Intentar reasignar
  const motivo: MotivoReasignacion =
    params.nuevoEstado === 'emergencia' ? 'repartidor_emergencia' : 'repartidor_no_disponible'

  return reasignarEntregas({
    ferreteriaId:        params.ferreteriaId,
    entregasIds,
    motivo,
    repartidorExcluirId: params.repartidorId,
    autoAprobar:         params.autoReasignar ?? false,
  }, supabase)
}

// ── Manejar avería de vehículo ────────────────────────────────────────────────

export async function manejarAveriaVehiculo(
  params: {
    ferreteriaId:        string
    vehiculoId:          string
    severidad:           'averia_leve' | 'averia_grave'
    descripcion:         string
    estResolucionMinutos?: number  // estimado de reparación
    repartidorId?:       string
    autoReasignar?:      boolean
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<ResultadoReasignacion> {
  const estResolucion = params.estResolucionMinutos
    ? new Date(Date.now() + params.estResolucionMinutos * 60_000)
    : null

  // 1. Actualizar estado del vehículo
  await supabase
    .from('vehiculos_delivery')
    .update({
      estado:             params.severidad,
      descripcion_averia: params.descripcion,
      est_resolucion_at:  estResolucion?.toISOString() ?? null,
    })
    .eq('id', params.vehiculoId)
    .eq('ferreteria_id', params.ferreteriaId)

  // 2. Registrar operación
  await registrarOperacion(params.ferreteriaId, 'averia_vehiculo', {
    vehiculoId:              params.vehiculoId,
    severidad:               params.severidad,
    descripcion:             params.descripcion,
    estResolucionMinutos:    params.estResolucionMinutos,
    repartidorId:            params.repartidorId,
  }, supabase)

  // 3. Obtener entregas activas de este vehículo
  const { data: entregas } = await supabase
    .from('entregas')
    .select('id, repartidor_id')
    .eq('vehiculo_id', params.vehiculoId)
    .eq('ferreteria_id', params.ferreteriaId)
    .in('estado', ['asignado', 'en_ruta', 'pendiente'])

  if (!entregas?.length) {
    // Recalcular ETAs de toda la cola (el vehículo ya no está disponible)
    await recalcularETAsCascada(params.ferreteriaId, supabase)
    return { exito: true, candidato: null, entregasReasignadas: [], requiereAprobacion: false, motivo: 'Sin entregas activas en este vehículo' }
  }

  const entregasIds = (entregas as Record<string, unknown>[]).map(e => e.id as string)

  // 4. Reasignar
  const resultado = await reasignarEntregas({
    ferreteriaId:     params.ferreteriaId,
    entregasIds,
    motivo:           params.severidad === 'averia_leve' ? 'averia_leve' : 'averia_vehiculo',
    vehiculoExcluirId: params.vehiculoId,
    autoAprobar:       params.autoReasignar ?? false,
  }, supabase)

  // 5. Siempre recalcular ETAs de la cola completa
  await recalcularETAsCascada(params.ferreteriaId, supabase)

  return resultado
}

// ── Helper interno ────────────────────────────────────────────────────────────

async function registrarOperacion(
  ferreteriaId: string,
  tipo:         string,
  detalle:      Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:     SupabaseClient<any>,
): Promise<void> {
  await supabase.from('delivery_operaciones_log').insert({
    ferreteria_id: ferreteriaId,
    tipo,
    detalle,
    origen: 'sistema',
  })
}
