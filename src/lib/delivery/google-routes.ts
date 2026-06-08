/**
 * Google Routes API v2 wrapper
 *
 * Uses the Routes API (REST, no npm dependency) for:
 * - Traffic-aware distance/duration between two points
 * - Route optimization with waypoint ordering
 *
 * Falls back gracefully if API key is missing or quota exceeded.
 */

interface LatLng {
  lat: number
  lng: number
}

interface GoogleRoutesResult {
  distanciaKm: number
  duracionMin: number
  duracionTraficoMin: number
  polyline?: string
}

interface GoogleRoutesError {
  error: string
}

// ── Distance with traffic ────────────────────────────────────────────────────

export async function getDistanceWithTraffic(
  origin: LatLng,
  dest: LatLng,
  apiKey: string,
): Promise<GoogleRoutesResult | null> {
  try {
    const res = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.staticDuration,routes.polyline',
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
          },
          destination: {
            location: { latLng: { latitude: dest.lat, longitude: dest.lng } },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          languageCode: 'es-PE',
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as GoogleRoutesError
      console.warn('[GoogleRoutes] API error:', res.status, err.error ?? '')
      return null
    }

    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null

    // duration comes as "123s" string
    const duracionSeg = parseInt(route.duration?.replace('s', '') ?? '0', 10)
    const duracionStaticSeg = parseInt(route.staticDuration?.replace('s', '') ?? '0', 10)
    const distanciaMetros = route.distanceMeters ?? 0

    return {
      distanciaKm: Math.round((distanciaMetros / 1000) * 10) / 10,
      duracionMin: Math.ceil(duracionSeg / 60),
      duracionTraficoMin: Math.ceil(duracionSeg / 60),
      polyline: route.polyline?.encodedPolyline,
    }
  } catch (e) {
    console.warn('[GoogleRoutes] Error:', e instanceof Error ? e.message : e)
    return null
  }
}

// ── Route optimization (waypoint ordering) ───────────────────────────────────

interface WaypointOptResult {
  optimizedOrder: number[]
  totalDistanceKm: number
  totalDurationMin: number
  legs: Array<{ distanceKm: number; durationMin: number }>
}

export async function optimizarRutaGoogle(
  origin: LatLng,
  destinations: LatLng[],
  apiKey: string,
): Promise<WaypointOptResult | null> {
  if (destinations.length === 0) return null
  if (destinations.length === 1) {
    const single = await getDistanceWithTraffic(origin, destinations[0], apiKey)
    if (!single) return null
    return {
      optimizedOrder: [0],
      totalDistanceKm: single.distanciaKm,
      totalDurationMin: single.duracionMin,
      legs: [{ distanceKm: single.distanciaKm, durationMin: single.duracionMin }],
    }
  }

  try {
    const intermediates = destinations.map(d => ({
      location: { latLng: { latitude: d.lat, longitude: d.lng } },
    }))

    const res = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs,routes.optimizedIntermediateWaypointIndex',
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
          },
          destination: {
            location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
          },
          intermediates,
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          optimizeWaypointOrder: true,
          languageCode: 'es-PE',
        }),
        signal: AbortSignal.timeout(15_000),
      },
    )

    if (!res.ok) return null

    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null

    const totalDur = parseInt(route.duration?.replace('s', '') ?? '0', 10)
    const totalDist = route.distanceMeters ?? 0

    const legs = (route.legs ?? []).map((leg: { distanceMeters?: number; duration?: string }) => ({
      distanceKm: Math.round(((leg.distanceMeters ?? 0) / 1000) * 10) / 10,
      durationMin: Math.ceil(parseInt(leg.duration?.replace('s', '') ?? '0', 10) / 60),
    }))

    return {
      optimizedOrder: route.optimizedIntermediateWaypointIndex ?? destinations.map((_, i) => i),
      totalDistanceKm: Math.round((totalDist / 1000) * 10) / 10,
      totalDurationMin: Math.ceil(totalDur / 60),
      legs,
    }
  } catch (e) {
    console.warn('[GoogleRoutes] Optimize error:', e instanceof Error ? e.message : e)
    return null
  }
}
