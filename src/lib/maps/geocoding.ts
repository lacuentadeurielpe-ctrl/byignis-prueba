/**
 * Geocoding server-side con Google Maps API
 * Se usa en:
 * - Bot al recibir dirección de cliente
 * - Pedido manual al guardar dirección
 */

interface GeocodingResult {
  lat: number
  lng: number
  direccion_formateada: string
  place_id?: string
}

export async function geocodeAddress(address: string, apiKey: string): Promise<GeocodingResult | null> {
  if (!address || !apiKey) return null

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', address)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('region', 'pe') // Prioriза Perú

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.length) {
      return null
    }

    const result = data.results[0]
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      direccion_formateada: result.formatted_address,
      place_id: result.place_id,
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

export async function reverseGeocode(lat: number, lng: number, apiKey: string): Promise<GeocodingResult | null> {
  if (!lat || !lng || !apiKey) return null

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('latlng', `${lat},${lng}`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('language', 'es')

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.length) {
      return null
    }

    const result = data.results[0]
    return {
      lat,
      lng,
      direccion_formateada: result.formatted_address,
      place_id: result.place_id,
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return null
  }
}
