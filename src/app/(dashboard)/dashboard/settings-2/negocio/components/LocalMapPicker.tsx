'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AlertCircle, Loader2, Navigation } from 'lucide-react'
import PlacesAutocomplete from './PlacesAutocomplete'
import type { GooglePlacesResult } from '@/types/locales'
import { geocodeAddress } from '@/lib/maps/geocoding'

interface LocalMapPickerProps {
  onLocationChange: (data: {
    direccion: string
    lat: number
    lng: number
    place_id?: string
  }) => void
  initialDireccion?: string
  initialLat?: number
  initialLng?: number
  autoSave?: boolean
}

export default function LocalMapPicker({
  onLocationChange,
  initialDireccion = '',
  initialLat,
  initialLng,
  autoSave = true,
}: LocalMapPickerProps) {
  const [direccion, setDireccion] = useState(initialDireccion)
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(
    initialLat && initialLng ? [initialLat, initialLng] : [-12.0464, -77.0428]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  // Debounce save
  const debouncedSave = useCallback(
    (data: { direccion: string; lat: number; lng: number; place_id?: string }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        onLocationChange(data)
      }, 800)
    },
    [onLocationChange]
  )

  // Initialize Google Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setError('Google Maps API no configurado')
      return
    }

    // Load Google Maps script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => {
      initMap()
    }
    script.onerror = () => {
      setError('No se pudo cargar Google Maps')
    }
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const initMap = () => {
    if (!mapContainerRef.current || !window.google) return

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: markerPosition[0], lng: markerPosition[1] },
      zoom: 15,
      mapTypeControl: true,
      fullscreenControl: true,
      streetViewControl: false,
    })

    mapRef.current = map

    // Create marker
    const marker = new window.google.maps.Marker({
      position: { lat: markerPosition[0], lng: markerPosition[1] },
      map: map,
      draggable: true,
      title: 'Tu ubicación',
    })

    markerRef.current = marker

    // Marker drag event
    marker.addListener('dragend', async () => {
      const pos = marker.getPosition()
      if (!pos) return

      const lat = pos.lat()
      const lng = pos.lng()
      setMarkerPosition([lat, lng])

      // Reverse geocode
      await performReverseGeocode(lat, lng)
    })

    // Map click event
    map.addListener('click', async (e: any) => {
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()

      marker.setPosition({ lat, lng })
      setMarkerPosition([lat, lng])

      // Reverse geocode
      await performReverseGeocode(lat, lng)
    })
  }

  const performReverseGeocode = async (lat: number, lng: number) => {
    setLoading(true)
    setError(null)

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        setError('Google Maps no configurado')
        setLoading(false)
        return
      }

      const result = await geocodeAddress(`${lat},${lng}`, apiKey)

      if (result) {
        setDireccion(result.direccion_formateada)

        if (autoSave) {
          debouncedSave({
            direccion: result.direccion_formateada,
            lat,
            lng,
            place_id: result.place_id,
          })
        } else {
          onLocationChange({
            direccion: result.direccion_formateada,
            lat,
            lng,
            place_id: result.place_id,
          })
        }
      } else {
        setError('No se pudo obtener la dirección')
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err)
      setError('Error al obtener dirección')
    } finally {
      setLoading(false)
    }
  }

  // Handle dirección input + PlacesAutocomplete
  const handleSelectPlace = async (result: GooglePlacesResult) => {
    setDireccion(result.descripcion)
    setMarkerPosition([result.lat, result.lng])
    setError(null)

    // Update map
    if (mapRef.current) {
      mapRef.current.setCenter({ lat: result.lat, lng: result.lng })
      mapRef.current.setZoom(16)
    }

    if (markerRef.current) {
      markerRef.current.setPosition({ lat: result.lat, lng: result.lng })
    }

    if (autoSave) {
      debouncedSave({
        direccion: result.descripcion,
        lat: result.lat,
        lng: result.lng,
        place_id: result.place_id,
      })
    } else {
      onLocationChange({
        direccion: result.descripcion,
        lat: result.lat,
        lng: result.lng,
        place_id: result.place_id,
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* Input con PlacesAutocomplete */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">📍 Ubicación del local</label>
        <PlacesAutocomplete
          value={direccion}
          onChange={setDireccion}
          onSelect={handleSelectPlace}
          placeholder="Escribe dirección o haz click en el mapa..."
          disabled={loading}
        />
        {error && (
          <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}
      </div>

      {/* Google Map interactivo */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="w-full h-96 rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-indigo-300 transition-colors bg-zinc-100"
        />

        {loading && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
            <div className="bg-white rounded-lg p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <p className="text-sm text-zinc-700">Obteniendo ubicación...</p>
            </div>
          </div>
        )}
      </div>

      {/* Info overlay */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs">
        <p className="text-blue-900 font-medium">💡 Cómo usar:</p>
        <ul className="text-blue-700 space-y-0.5 mt-1">
          <li>• Escribe la dirección en el campo arriba</li>
          <li>• O haz click directamente en el mapa</li>
          <li>• Arrastra el marcador para ajustar</li>
          <li>• Se guarda automáticamente cada 800ms</li>
        </ul>
      </div>

      {/* Coordenadas en tiempo real */}
      {markerPosition && (
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
          <p className="text-xs font-medium text-zinc-700">📍 Coordenadas:</p>
          <p className="text-xs text-zinc-600 font-mono">
            Lat: <span className="text-zinc-900">{markerPosition[0].toFixed(6)}</span> | Lng:{' '}
            <span className="text-zinc-900">{markerPosition[1].toFixed(6)}</span>
          </p>
          {direccion && <p className="text-xs text-zinc-600">Dirección: {direccion}</p>}
        </div>
      )}
    </div>
  )
}
