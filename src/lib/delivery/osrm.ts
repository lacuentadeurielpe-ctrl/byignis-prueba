/**
 * OSRM Client — rutas reales por calles vía OSRM público
 *
 * API base: https://router.project-osrm.org
 * Sin API key, sin registro, datos de OpenStreetMap.
 * Lima está bien cubierta en OSM.
 *
 * Endpoints usados:
 *   /route  → ruta entre 2 puntos (distancia + tiempo real)
 *   /trip   → TSP multi-parada (orden óptimo de N paradas)
 *   /table  → matriz de tiempos/distancias entre N puntos
 *   /nearest→ calle más cercana a un punto GPS
 */

const OSRM_BASE = 'https://router.project-osrm.org'
const TIMEOUT_MS = 8000  // 8s timeout — fallback a haversine si tarda más

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Coords {
  lat: number
  lng: number
}

export interface OsrmLeg {
  distanciaM: number    // metros
  duracionS:  number    // segundos
  distanciaKm: number
  duracionMin: number
}

export interface OsrmRoute {
  distanciaKm:  number
  duracionMin:  number
  polyline:     string | null  // encoded polyline para mapa
  legs:         OsrmLeg[]
}

export interface OsrmTripParada {
  indiceOriginal: number   // índice en el array de entrada
  orden:          number   // orden optimizado (0-indexed)
  distanciaKm:    number   // leg hacia esta parada
  duracionMin:    number   // minutos desde parada anterior
  etaAcumuladaMin: number  // tiempo total desde salida
}

export interface OsrmTrip {
  distanciaKm:   number
  duracionMin:   number
  polyline:      string | null
  paradas:       OsrmTripParada[]
}

export interface OsrmTableResult {
  /** duraciones[i][j] = tiempo en minutos desde punto i hasta punto j */
  duraciones: number[][]
  /** distancias[i][j] = distancia en km desde punto i hasta punto j */
  distancias: number[][]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function coordStr(c: Coords): string {
  return `${c.lng},${c.lat}`
}

async function osrmFetch(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`OSRM ${res.status}: ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ── Haversine fallback (si OSRM no responde) ──────────────────────────────────

function haversineKm(a: Coords, b: Coords): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function haversineRoute(origin: Coords, dest: Coords, velocidadKmh = 30): OsrmRoute {
  const dist = haversineKm(origin, dest) * 1.35  // factor urbano
  const dur  = (dist / velocidadKmh) * 60
  return {
    distanciaKm: Math.round(dist * 100) / 100,
    duracionMin: Math.ceil(dur),
    polyline:    null,
    legs: [{
      distanciaM:  dist * 1000,
      duracionS:   dur * 60,
      distanciaKm: Math.round(dist * 100) / 100,
      duracionMin: Math.ceil(dur),
    }],
  }
}

// ── A) /route — ruta entre origen y destino ──────────────────────────────────

/**
 * Calcula la ruta real por calles entre dos puntos.
 * Fallback a Haversine × 1.35 si OSRM no responde.
 */
export async function calcularRuta(
  origin: Coords,
  dest:   Coords,
  velocidadFallbackKmh = 30,
): Promise<OsrmRoute> {
  const url = `${OSRM_BASE}/route/v1/driving/${coordStr(origin)};${coordStr(dest)}?overview=simplified&steps=false`

  try {
    const data = await osrmFetch(url) as {
      code: string
      routes?: Array<{
        distance: number
        duration: number
        geometry: string
        legs: Array<{ distance: number; duration: number }>
      }>
    }

    if (data.code !== 'Ok' || !data.routes?.length) {
      return haversineRoute(origin, dest, velocidadFallbackKmh)
    }

    const r = data.routes[0]
    return {
      distanciaKm: Math.round((r.distance / 1000) * 100) / 100,
      duracionMin: Math.ceil(r.duration / 60),
      polyline:    r.geometry ?? null,
      legs: (r.legs ?? []).map(l => ({
        distanciaM:  l.distance,
        duracionS:   l.duration,
        distanciaKm: Math.round((l.distance / 1000) * 100) / 100,
        duracionMin: Math.ceil(l.duration / 60),
      })),
    }
  } catch {
    return haversineRoute(origin, dest, velocidadFallbackKmh)
  }
}

// ── B) /trip — TSP multi-parada con orden óptimo ─────────────────────────────

/**
 * Dado origen + N paradas, calcula el orden óptimo de visita (viajante de comercio).
 * El origen siempre es el punto 0 (la ferretería o posición actual del repartidor).
 * Fallback a nearest-neighbor haversine si OSRM falla.
 */
export async function optimizarRutaOSRM(
  origen:    Coords,
  paradas:   Array<{ id: string; coords: Coords }>,
  tiempoPrepaMin = 10,    // tiempo de preparación antes de salir
  tiempoParadaMin = 3,    // tiempo de entrega en cada parada
): Promise<OsrmTrip> {
  if (paradas.length === 0) {
    return { distanciaKm: 0, duracionMin: 0, polyline: null, paradas: [] }
  }

  // Construir waypoints: origen + todas las paradas
  const waypoints = [origen, ...paradas.map(p => p.coords)]
  const coordsStr = waypoints.map(coordStr).join(';')

  // source=0 fija el origen, roundtrip=false (no vuelve al inicio)
  const url = `${OSRM_BASE}/trip/v1/driving/${coordsStr}?source=first&roundtrip=false&overview=simplified`

  try {
    const data = await osrmFetch(url) as {
      code:  string
      trips?: Array<{
        distance: number
        duration: number
        geometry: string
        legs: Array<{ distance: number; duration: number }>
      }>
      waypoints?: Array<{ waypoint_index: number; trips_index: number }>
    }

    if (data.code !== 'Ok' || !data.trips?.length) {
      return optimizarRutaFallback(origen, paradas, tiempoPrepaMin, tiempoParadaMin)
    }

    const trip   = data.trips[0]
    const wps    = data.waypoints ?? []

    // Mapear orden optimizado (ignorar waypoint 0 = origen)
    let etaAcum = tiempoPrepaMin
    const paradasResult: OsrmTripParada[] = []

    for (let orden = 0; orden < paradas.length; orden++) {
      const leg = trip.legs[orden] ?? { distance: 0, duration: 0 }
      const durLeg = Math.ceil(leg.duration / 60)
      etaAcum += durLeg
      if (orden > 0) etaAcum += tiempoParadaMin  // tiempo en parada anterior

      // El waypoint_index en los waypoints apunta al punto en el trip
      // Necesitamos mapear de vuelta al índice original en `paradas`
      const wpOriginal = wps.find(w => w.waypoint_index === orden + 1)
      const idxOriginal = wpOriginal ? orden : orden  // OSRM ordena desde 1 (origen es 0)

      paradasResult.push({
        indiceOriginal: idxOriginal,
        orden,
        distanciaKm:    Math.round((leg.distance / 1000) * 100) / 100,
        duracionMin:    durLeg,
        etaAcumuladaMin: etaAcum,
      })
    }

    return {
      distanciaKm: Math.round((trip.distance / 1000) * 100) / 100,
      duracionMin: Math.ceil(trip.duration / 60) + tiempoPrepaMin,
      polyline:    trip.geometry ?? null,
      paradas:     paradasResult,
    }
  } catch {
    return optimizarRutaFallback(origen, paradas, tiempoPrepaMin, tiempoParadaMin)
  }
}

/** Nearest-neighbor fallback si OSRM no responde */
function optimizarRutaFallback(
  origen:    Coords,
  paradas:   Array<{ id: string; coords: Coords }>,
  tiempoPrepaMin: number,
  tiempoParadaMin: number,
): OsrmTrip {
  const pendientes = [...paradas.entries()]
  const result: OsrmTripParada[] = []
  let current = origen
  let etaAcum = tiempoPrepaMin
  let distTotal = 0
  let orden = 0

  while (pendientes.length > 0) {
    let minDist = Infinity
    let minIdx  = 0
    for (const [i, [, p]] of pendientes.entries()) {
      const d = haversineKm(current, p.coords) * 1.35
      if (d < minDist) { minDist = d; minIdx = i }
    }

    const [[origIdx, p]] = pendientes.splice(minIdx, 1)
    const durMin = Math.ceil((minDist / 30) * 60)
    if (orden > 0) etaAcum += tiempoParadaMin
    etaAcum += durMin
    distTotal += minDist

    result.push({
      indiceOriginal: origIdx,
      orden,
      distanciaKm:    Math.round(minDist * 100) / 100,
      duracionMin:    durMin,
      etaAcumuladaMin: etaAcum,
    })

    current = p.coords
    orden++
  }

  return {
    distanciaKm: Math.round(distTotal * 100) / 100,
    duracionMin: etaAcum,
    polyline:    null,
    paradas:     result,
  }
}

// ── C) /table — matriz de tiempos y distancias entre N puntos ────────────────

/**
 * Calcula la matriz de tiempos y distancias entre todos los puntos.
 * Útil para encontrar el repartidor más cercano a un pedido nuevo.
 *
 * @param puntos Array de coordenadas. Índice 0 suele ser el pedido, resto son repartidores.
 * @returns Matriz [i][j] con tiempo en minutos y distancia en km
 */
export async function calcularMatriz(puntos: Coords[]): Promise<OsrmTableResult> {
  if (puntos.length < 2) {
    return { duraciones: [[0]], distancias: [[0]] }
  }

  const coordsStr = puntos.map(coordStr).join(';')
  const url = `${OSRM_BASE}/table/v1/driving/${coordsStr}?annotations=duration,distance`

  try {
    const data = await osrmFetch(url) as {
      code:      string
      durations?: number[][]
      distances?: number[][]
    }

    if (data.code !== 'Ok' || !data.durations) {
      return calcularMatrizFallback(puntos)
    }

    const duraciones = (data.durations ?? []).map(row =>
      row.map(s => s === null ? 9999 : Math.ceil(s / 60))
    )
    const distancias = (data.distances ?? []).map(row =>
      row.map(m => m === null ? 9999 : Math.round((m / 1000) * 100) / 100)
    )

    return { duraciones, distancias }
  } catch {
    return calcularMatrizFallback(puntos)
  }
}

function calcularMatrizFallback(puntos: Coords[]): OsrmTableResult {
  const n = puntos.length
  const duraciones: number[][] = []
  const distancias: number[][] = []

  for (let i = 0; i < n; i++) {
    duraciones.push([])
    distancias.push([])
    for (let j = 0; j < n; j++) {
      if (i === j) {
        duraciones[i].push(0)
        distancias[i].push(0)
      } else {
        const km = haversineKm(puntos[i], puntos[j]) * 1.35
        duraciones[i].push(Math.ceil((km / 30) * 60))
        distancias[i].push(Math.round(km * 100) / 100)
      }
    }
  }

  return { duraciones, distancias }
}

// ── D) /nearest — calle más cercana a un punto GPS ───────────────────────────

/**
 * Dado un punto GPS, devuelve el punto exacto en la calle más cercana.
 * Útil para snap de coordenadas antes de enviarlas a /route o /trip.
 */
export async function snapToRoad(point: Coords): Promise<Coords> {
  const url = `${OSRM_BASE}/nearest/v1/driving/${coordStr(point)}?number=1`

  try {
    const data = await osrmFetch(url) as {
      code:       string
      waypoints?: Array<{ location: [number, number] }>
    }

    if (data.code !== 'Ok' || !data.waypoints?.length) return point

    const [lng, lat] = data.waypoints[0].location
    return { lat, lng }
  } catch {
    return point  // fallback: usar el punto original
  }
}

// ── E) Encontrar el repartidor más cercano a un pedido ───────────────────────

/**
 * Dado un pedido y una lista de repartidores disponibles con su posición GPS,
 * devuelve el ID del repartidor más cercano según OSRM (o haversine como fallback).
 */
export async function encontrarRepartidorMasCercano(
  destinoPedido: Coords,
  repartidores:  Array<{ id: string; coords: Coords }>,
): Promise<{ repartidorId: string; duracionMin: number; distanciaKm: number } | null> {
  if (!repartidores.length) return null
  if (repartidores.length === 1) {
    const r = repartidores[0]
    const ruta = await calcularRuta(r.coords, destinoPedido)
    return { repartidorId: r.id, duracionMin: ruta.duracionMin, distanciaKm: ruta.distanciaKm }
  }

  // Usar /table: fila 0 = destino pedido, columnas = posición de cada repartidor
  const puntos = [destinoPedido, ...repartidores.map(r => r.coords)]
  const { duraciones, distancias } = await calcularMatriz(puntos)

  // La fila 0 del resultado = desde el pedido hacia cada repartidor
  // Queremos columnas 1..N (repartidores) en la fila 0
  let minDur = Infinity
  let minIdx = 0
  for (let i = 1; i < puntos.length; i++) {
    if (duraciones[i][0] < minDur) {
      minDur = duraciones[i][0]
      minIdx = i - 1
    }
  }

  return {
    repartidorId: repartidores[minIdx].id,
    duracionMin:  minDur,
    distanciaKm:  distancias[minIdx + 1][0],
  }
}
