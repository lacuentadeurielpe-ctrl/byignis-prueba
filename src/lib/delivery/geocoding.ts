/**
 * Geocoding — doble motor
 *
 * Motor 1 (primario): Google Maps Geocoding API
 *   - Entiende direcciones coloquiales peruanas ("paradero 12", "frente al mercado", etc.)
 *   - Location bias: prioriza resultados cerca del local de la ferretería
 *   - Si la dirección es de otra ciudad/región, igual la encuentra aunque esté fuera del radio
 *   - Requiere NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 *
 * Motor 2 (fallback): Nominatim (OpenStreetMap)
 *   - Sin API key, gratuito
 *   - ToS: máximo 1 req/seg, User-Agent obligatorio
 *   - Menos capaz con direcciones coloquiales
 */

const NOMINATIM_URL     = 'https://nominatim.openstreetmap.org/search'
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const USER_AGENT        = 'FerroBot/1.0 (ferrobot-flax.vercel.app; contacto@ferrobot.pe)'

export interface Coordenadas {
  lat: number
  lng: number
}

/** Bias de ubicación para Google Geocoding — prioriza resultados dentro del radio */
export interface LocationBias {
  lat: number
  lng: number
  radiusKm?: number  // default 50 km
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  importance: number
}

interface GoogleGeocodeResult {
  status: string
  results: Array<{
    geometry: { location: { lat: number; lng: number } }
    formatted_address: string
    types: string[]
  }>
}

// ── Google Geocoding ──────────────────────────────────────────────────────────

/**
 * Geocodifica con Google Maps Geocoding API.
 * Si se pasa `bias`, aplica viewport bias centrado en ese punto para priorizar
 * resultados locales (útil para "paradero 12" → resuelve en la ciudad del local).
 * Aun así, si la dirección es de otra región, Google la encuentra igualmente.
 */
async function geocodificarConGoogle(
  direccion: string,
  apiKey: string,
  bias?: LocationBias,
): Promise<Coordenadas | null> {
  const params = new URLSearchParams({
    address: direccion,
    key: apiKey,
    language: 'es',
    region: 'pe',
  })

  // Viewport bias: bounding box ~radiusKm alrededor del local
  if (bias) {
    const radiusKm = bias.radiusKm ?? 50
    const latOff = radiusKm / 111.32
    const lngOff = radiusKm / (111.32 * Math.cos((bias.lat * Math.PI) / 180))
    const sw = `${(bias.lat - latOff).toFixed(6)},${(bias.lng - lngOff).toFixed(6)}`
    const ne = `${(bias.lat + latOff).toFixed(6)},${(bias.lng + lngOff).toFixed(6)}`
    params.set('bounds', `${sw}|${ne}`)
  }

  try {
    const res = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!res.ok) return null

    const data = (await res.json()) as GoogleGeocodeResult

    if (data.status === 'OK' && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location
      return { lat, lng }
    }

    // ZERO_RESULTS u otro status no-OK
    return null
  } catch {
    return null
  }
}

// ── Nominatim (fallback) ──────────────────────────────────────────────────────

async function geocodificarConNominatim(
  direccion: string,
  ciudad = 'Perú',
): Promise<Coordenadas | null> {
  const query = `${direccion.trim()}, ${ciudad}`

  try {
    const url = new URL(NOMINATIM_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'pe')
    url.searchParams.set('addressdetails', '0')

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent':      USER_AGENT,
        'Accept-Language': 'es',
        'Accept':          'application/json',
      },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = (await res.json()) as NominatimResult[]
    if (!data.length) return null

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch {
    return null
  }
}

// ── API Pública ───────────────────────────────────────────────────────────────

/**
 * Geocodifica una dirección de texto.
 *
 * Prioridad:
 *   1. Google Maps Geocoding API (si NEXT_PUBLIC_GOOGLE_MAPS_API_KEY existe)
 *      → con location bias si se pasa `bias` (coords del local de la ferretería)
 *   2. Nominatim como fallback (añade `ciudad` al query para contexto)
 *
 * @param direccion  Dirección libre ("paradero 12, calle cesar vallejo")
 * @param ciudad     Ciudad/región para contexto en Nominatim fallback (ej: "Moche, Trujillo")
 * @param bias       Coords del local para que Google priorice resultados cercanos
 */
export async function geocodificarDireccion(
  direccion: string,
  ciudad = 'Perú',
  bias?: LocationBias,
): Promise<Coordenadas | null> {
  if (!direccion?.trim()) return null

  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Motor 1: Google (con location bias si tenemos coords del local)
  if (googleApiKey) {
    const result = await geocodificarConGoogle(direccion.trim(), googleApiKey, bias)
    if (result) return result
    // Si Google falla (ej. cuota agotada), caer a Nominatim
  }

  // Motor 2: Nominatim (añade ciudad para contexto)
  return geocodificarConNominatim(direccion.trim(), ciudad)
}

// ── Helpers con caché en BD ───────────────────────────────────────────────────

/**
 * Geocodifica la dirección de una ferretería y la guarda en la BD.
 * Solo llama a la API si la ferretería aún no tiene coordenadas.
 */
export async function geocodificarFerreteria(
  ferreteriaId: string,
  direccion: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<Coordenadas | null> {
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('lat, lng, nombre')
    .eq('id', ferreteriaId)
    .single()

  if (ferreteria?.lat && ferreteria?.lng) {
    return { lat: ferreteria.lat, lng: ferreteria.lng }
  }

  const coords = await geocodificarDireccion(direccion)
  if (!coords) return null

  await supabase
    .from('ferreterias')
    .update({ lat: coords.lat, lng: coords.lng })
    .eq('id', ferreteriaId)

  return coords
}

/**
 * Geocodifica la dirección de un cliente con caché en BD.
 * Pasa las coords del local como bias para mejorar resolución de direcciones coloquiales.
 */
export async function geocodificarCliente(
  telefono: string,
  direccion: string,
  ferreteriaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bias?: LocationBias,
): Promise<Coordenadas | null> {
  // Buscar en caché
  const { data: cliente } = await supabase
    .from('clientes')
    .select('lat, lng, direccion_geocodificada')
    .eq('telefono', telefono)
    .eq('ferreteria_id', ferreteriaId)
    .single()

  if (
    cliente?.lat &&
    cliente?.lng &&
    cliente?.direccion_geocodificada === direccion
  ) {
    return { lat: cliente.lat, lng: cliente.lng }
  }

  const coords = await geocodificarDireccion(direccion, 'Perú', bias)
  if (!coords) return null

  // Guardar en caché
  await supabase
    .from('clientes')
    .update({
      lat: coords.lat,
      lng: coords.lng,
      direccion_geocodificada: direccion,
    })
    .eq('telefono', telefono)
    .eq('ferreteria_id', ferreteriaId)

  return coords
}
