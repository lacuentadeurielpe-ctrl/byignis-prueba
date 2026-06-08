'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import PlacesAutocomplete from './PlacesAutocomplete'
import type { GooglePlacesResult } from '@/types/locales'
import { geocodeAddress } from '@/lib/maps/geocoding'

// Leaflet - no SSR
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })

// MapClickHandler como componente dinámico
const MapClickHandler = dynamic(
  () => import('./MapClickHandler').then(m => m.default),
  { ssr: false }
)

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
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    initialLat && initialLng ? [initialLat, initialLng] : [-12.0464, -77.0428]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Handle mapa click (reverse geocoding)
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

  if (!markerPosition) {
    return <div className="text-sm text-zinc-500">Cargando mapa...</div>
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

      {/* Mapa interactivo */}
      <div className="relative">
        <div className="w-full h-96 rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-indigo-300 transition-colors">
          <MapContainer center={markerPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />

            {markerPosition && <Marker position={markerPosition} />}

            <MapClickHandler
              markerPosition={markerPosition}
              setMarkerPosition={setMarkerPosition}
              onMapClick={handleMapClick}
            />
          </MapContainer>

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
        <div className="absolute bottom-3 left-3 bg-white rounded-lg px-3 py-2 shadow-lg border border-zinc-200 text-xs max-w-xs">
          <p className="text-zinc-900 font-medium">💡 Instrucciones:</p>
          <ul className="text-zinc-600 space-y-0.5 mt-1">
            <li>• Escribe la dirección arriba para buscar</li>
            <li>• O haz click en el mapa para marcar</li>
            <li>• Se guarda automáticamente</li>
          </ul>
        </div>
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
