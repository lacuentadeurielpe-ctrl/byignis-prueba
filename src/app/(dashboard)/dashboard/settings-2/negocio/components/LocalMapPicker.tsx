'use client'

import { useState, useCallback, useRef } from 'react'
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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mapIframeRef = useRef<HTMLIFrameElement>(null)

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

  // Handle dirección input + PlacesAutocomplete
  const handleSelectPlace = async (result: GooglePlacesResult) => {
    setDireccion(result.descripcion)
    setMarkerPosition([result.lat, result.lng])
    setError(null)

    // Update iframe with new coordinates
    if (mapIframeRef.current) {
      const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${result.lng - 0.01},${result.lat - 0.01},${result.lng + 0.01},${result.lat + 0.01}&layer=mapnik&marker=${result.lat},${result.lng}`
      mapIframeRef.current.src = mapUrl
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

  // Handle manual map click - reverse geocoding
  const handleMapClick = async (lat: number, lng: number) => {
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
        setMarkerPosition([lat, lng])

        // Update iframe
        if (mapIframeRef.current) {
          const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`
          mapIframeRef.current.src = mapUrl
        }

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

  return (
    <div className="space-y-3">
      {/* Input con PlacesAutocomplete */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          📍 Ubicación del local
        </label>
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

      {/* Mapa embebido de OpenStreetMap */}
      <div className="relative">
        <div className="w-full rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-indigo-300 transition-colors">
          <iframe
            ref={mapIframeRef}
            width="100%"
            height="400"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen={true}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${markerPosition[1] - 0.01},${markerPosition[0] - 0.01},${markerPosition[1] + 0.01},${markerPosition[0] + 0.01}&layer=mapnik&marker=${markerPosition[0]},${markerPosition[1]}`}
          />
        </div>

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
        <p className="text-blue-900 font-medium">💡 Instrucciones:</p>
        <ul className="text-blue-700 space-y-0.5 mt-1">
          <li>• Escribe la dirección arriba para buscar</li>
          <li>• El mapa se actualizará automáticamente</li>
          <li>• Se guarda automáticamente</li>
        </ul>
      </div>

      {/* Coordenadas en tiempo real */}
      {markerPosition && (
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
          <p className="text-xs font-medium text-zinc-700">Coordenadas:</p>
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
