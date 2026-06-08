/**
 * Distance Matrix API server-side con Google Maps
 * Se usa en:
 * - Bot delivery: calcular costo según distancia
 * - Pedido manual: mostrar ETA al asignar repartidor
 * - Elegir local más cercano al cliente
 */

export interface DistanceResult {
  distancia_metros: number
  distancia_km: number
  duracion_segundos: number
  duracion_minutos: number
  duracion_legible: string
  status: string
}

export async function getDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  apiKey: string
): Promise<DistanceResult | null> {
  if (!origin.lat || !origin.lng || !destination.lat || !destination.lng || !apiKey) {
    return null
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins', `${origin.lat},${origin.lng}`)
    url.searchParams.set('destinations', `${destination.lat},${destination.lng}`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('language', 'es')

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('Distance Matrix API error:', data.error_message)
      return null
    }

    const element = data.rows[0]?.elements[0]
    if (!element || element.status !== 'OK') {
      return null
    }

    const distanceMetros = element.distance.value
    const duracionSegundos = element.duration.value

    return {
      distancia_metros: distanceMetros,
      distancia_km: Math.round((distanceMetros / 1000) * 100) / 100,
      duracion_segundos: duracionSegundos,
      duracion_minutos: Math.ceil(duracionSegundos / 60),
      duracion_legible: formatDuration(duracionSegundos),
      status: element.status,
    }
  } catch (error) {
    console.error('Distance calculation error:', error)
    return null
  }
}

/**
 * Calcula el local más cercano a una ubicación
 */
export async function findClosestLocal(
  target: { lat: number; lng: number },
  locales: Array<{ id: string; lat?: number; lng?: number }>,
  apiKey: string
): Promise<{ local_id: string; distancia_km: number } | null> {
  const localesConCoordenadas = locales.filter(l => l.lat && l.lng)

  if (localesConCoordenadas.length === 0) {
    return null
  }

  if (localesConCoordenadas.length === 1) {
    return {
      local_id: localesConCoordenadas[0].id,
      distancia_km: 0,
    }
  }

  try {
    const results = await Promise.all(
      localesConCoordenadas.map(async local => {
        const distance = await getDistance(
          { lat: local.lat!, lng: local.lng! },
          target,
          apiKey
        )
        return {
          local_id: local.id,
          distancia_km: distance?.distancia_km ?? Infinity,
        }
      })
    )

    return results.reduce((closest, current) =>
      current.distancia_km < closest.distancia_km ? current : closest
    )
  } catch (error) {
    console.error('Closest local calculation error:', error)
    return null
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}
