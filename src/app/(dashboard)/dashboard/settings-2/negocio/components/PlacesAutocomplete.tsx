'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2, AlertCircle } from 'lucide-react'
import type { GooglePlacesResult } from '@/types/locales'

interface PlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (result: GooglePlacesResult) => void
  placeholder?: string
  disabled?: boolean
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Buscar dirección...',
  disabled = false,
}: PlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesRef = useRef<google.maps.places.PlacesService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  // Cargar Google Maps Script y inicializar servicios
  useEffect(() => {
    const initMaps = async () => {
      try {
        // Esperar a que Google Maps esté disponible
        const checkGoogleMaps = () => {
          return new Promise<void>((resolve, reject) => {
            const maxAttempts = 50
            let attempts = 0

            const interval = setInterval(() => {
              if (window.google?.maps?.places) {
                clearInterval(interval)
                resolve()
              }
              attempts++
              if (attempts >= maxAttempts) {
                clearInterval(interval)
                reject(new Error('Google Maps no cargó'))
              }
            }, 100)
          })
        }

        await checkGoogleMaps()

        // Inicializar servicios
        autocompleteRef.current = new window.google.maps.places.AutocompleteService()
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()

        const dummy = document.createElement('div')
        placesRef.current = new window.google.maps.places.PlacesService(dummy)

        setIsInitialized(true)
      } catch (err) {
        console.error('Error initializing Maps:', err)
        setError('Google Maps no disponible')
      }
    }

    // Cargar el script si no está presente
    if (!window.google?.maps?.places) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        setError('API Key no configurada')
        return
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es`
      script.async = true
      script.defer = true

      script.onload = () => initMaps()
      script.onerror = () => setError('Error cargando Google Maps')

      document.head.appendChild(script)

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script)
        }
      }
    } else {
      initMaps()
    }
  }, [])

  const handleSearch = useCallback(
    async (query: string) => {
      onChange(query)

      if (!query.trim()) {
        setSuggestions([])
        setIsOpen(false)
        return
      }

      if (!isInitialized || !autocompleteRef.current) {
        return
      }

      setIsLoading(true)
      try {
        const response = await new Promise<google.maps.places.AutocompletePrediction[]>(
          resolve => {
            autocompleteRef.current!.getPlacePredictions(
              {
                input: query,
                componentRestrictions: { country: 'pe' },
                sessionToken: sessionTokenRef.current || undefined,
              },
              (predictions, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                  resolve(predictions)
                } else {
                  resolve([])
                }
              }
            )
          }
        )

        setSuggestions(response)
        setIsOpen(response.length > 0)
      } catch (err) {
        console.error('Autocomplete error:', err)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    },
    [onChange, isInitialized]
  )

  const handleSelectSuggestion = useCallback(
    (suggestion: google.maps.places.AutocompletePrediction) => {
      onChange(suggestion.description)
      setIsOpen(false)

      // Obtener detalles del lugar
      if (!placesRef.current) return

      const request = {
        placeId: suggestion.place_id,
        fields: ['geometry', 'formatted_address', 'place_id'],
        sessionToken: sessionTokenRef.current || undefined,
      }

      placesRef.current.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          onSelect({
            descripcion: place.formatted_address || suggestion.description,
            place_id: suggestion.place_id,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          })
          // Nueva sesión después de seleccionar
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
        }
      })
    },
    [onChange, onSelect]
  )

  if (error) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Configura Google Maps en {' '}
            <a href="/dashboard/settings-2/integraciones/maps" className="underline font-medium hover:no-underline">
              Integraciones
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => value.trim() && suggestions.length > 0 && setIsOpen(true)}
          disabled={disabled || !isInitialized}
          placeholder={isInitialized ? placeholder : 'Cargando Google Maps...'}
          className="w-full pl-10 pr-10 py-2.5 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-zinc-50 disabled:text-zinc-500"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-lg shadow-lg z-50">
          <ul className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-zinc-100 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {suggestion.main_text}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {suggestion.secondary_text}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
