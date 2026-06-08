'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
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
  const [mapReady, setMapReady] = useState(false)
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

    // Esperar a que Google Maps esté disponible
    const checkAndInit = () => {
      if (window.google?.maps) {
        initMap()
      } else {
        setTimeout(checkAndInit, 100)
      }
    }

    checkAndInit()
  }, [])

  const initMap = () => {
    if (!mapContainerRef.current || !window.google?.maps || mapRef.current) return

    try {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: markerPosition[0], lng: markerPosition[1] },
        zoom: 16,
        mapTypeControl: true,
        fullscreenControl: false,
        streetViewControl: false,
      })

      mapRef.current = map

      // Create draggable marker
      const marker = new window.google.maps.Marker({
        position: { lat: markerPosition[0], lng: markerPosition[1] },
        map: map,
        draggable: true,
        title: 'Arrastra para ajustar ubicación',
      })

      markerRef.current = marker

      // Marker dragend event
      marker.addListener('dragend', async () => {
        const pos = marker.getPosition()
        if (!pos) return

        const lat = pos.lat()
        const lng = pos.lng()
        setMarkerPosition([lat, lng])
        await performReverseGeocode(lat, lng)
      })

      // Map click event - CRITICAL
      map.addListener('click', async (e: any) => {
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()

        // Mover marcador
        marker.setPosition({ lat, lng })
        setMarkerPosition([lat, lng])

        // Reverse geocode
        await performReverseGeocode(lat, lng)
      })

      setMapReady(true)
      setError(null)
    } catch (err) {
      console.error('Error initializing map:', err)
      setError('Error al cargar el mapa')
    }
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
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle PlacesAutocomplete selection
  const handleSelectPlace = async (result: GooglePlacesResult) => {
    setDireccion(result.descripcion)
    setMarkerPosition([result.lat, result.lng])
    setError(null)

    // Update map center and zoom
    if (mapRef.current) {
      mapRef.current.setCenter({ lat: result.lat, lng: result.lng })
      mapRef.current.setZoom(16)
    }

    // Update marker
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
    <div className="space-y-3 relative z-10">
      {/* Input con PlacesAutocomplete */}
      <div className="relative z-40">
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
      <div className="relative z-0">
        <div
          ref={mapContainerRef}
          className="w-full h-96 rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-indigo-300 transition-colors bg-zinc-100"
        />

        {!mapReady && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
            <div className="bg-white rounded-lg p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <p className="text-sm text-zinc-700">Cargando mapa...</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
            <div className="bg-white rounded-lg p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <p className="text-sm text-zinc-700">Obteniendo dirección...</p>
            </div>
          </div>
        )}
      </div>

      {/* Info overlay */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs">
        <p className="text-blue-900 font-medium">💡 Cómo usar:</p>
        <ul className="text-blue-700 space-y-0.5 mt-1">
          <li>• <strong>Escribe</strong> la dirección arriba para buscar</li>
          <li>• <strong>Haz click</strong> en el mapa para marcar ubicación</li>
          <li>• <strong>Arrastra el marcador</strong> rojo para ajustar</li>
          <li>• Se guarda automáticamente en 800ms</li>
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
