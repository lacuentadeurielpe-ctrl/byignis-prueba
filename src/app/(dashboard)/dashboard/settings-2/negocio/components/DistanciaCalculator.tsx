'use client'

import { useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import PlacesAutocomplete from './PlacesAutocomplete'
import type { Local, GooglePlacesResult } from '@/types/locales'
import { getDistance } from '@/lib/maps/distance'

interface DistanciaCalculatorProps {
  locales: Local[]
}

interface ResultadoDistancia {
  local: Local
  distancia_km: number
  duracion_minutos: number
}

export default function DistanciaCalculator({ locales }: DistanciaCalculatorProps) {
  const [direccion, setDireccion] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [resultados, setResultados] = useState<ResultadoDistancia[]>([])
  const [loading, setLoading] = useState(false)

  const handleSelectPlace = async (result: GooglePlacesResult) => {
    setDireccion(result.descripcion)
    setCoords({ lat: result.lat, lng: result.lng })

    // Calcular distancias automáticamente
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      toast.error('Google Maps no está configurado')
      return
    }

    setLoading(true)
    try {
      const localesConCoordenadas = locales.filter(l => l.lat && l.lng && l.activo)

      if (localesConCoordenadas.length === 0) {
        toast.error('No hay locales con coordenadas')
        setLoading(false)
        return
      }

      const distancias = await Promise.all(
        localesConCoordenadas.map(async local => {
          const distance = await getDistance(
            { lat: local.lat!, lng: local.lng! },
            { lat: result.lat, lng: result.lng },
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
          )
          return {
            local,
            distancia_km: distance?.distancia_km ?? 0,
            duracion_minutos: distance?.duracion_minutos ?? 0,
          }
        })
      )

      // Ordenar por distancia
      const ordenados = distancias.sort((a, b) => a.distancia_km - b.distancia_km)
      setResultados(ordenados)
    } catch (error) {
      console.error('Error calculando distancias:', error)
      toast.error('Error al calcular distancias')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setDireccion('')
    setCoords(null)
    setResultados([])
  }

  return (
    <div className="space-y-4">
      {/* Input */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          Dirección del cliente
        </label>
        <PlacesAutocomplete
          value={direccion}
          onChange={setDireccion}
          onSelect={handleSelectPlace}
          placeholder="Ingresa dirección para calcular distancias..."
        />
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Locales por distancia</h3>
            <button
              onClick={handleClear}
              className="text-xs text-zinc-500 hover:text-zinc-700 underline"
            >
              Limpiar
            </button>
          </div>

          <div className="space-y-2">
            {resultados.map(resultado => (
              <div
                key={resultado.local.id}
                className="p-3 border border-zinc-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-zinc-900 truncate">
                        {resultado.local.nombre}
                      </p>
                      {resultado.local.es_principal && (
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded flex-shrink-0">
                          ⭐
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {resultado.local.direccion}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-indigo-600">
                      {resultado.distancia_km.toFixed(1)} km
                    </p>
                    <p className="text-xs text-zinc-500">
                      ~{resultado.duracion_minutos} min
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="text-xs text-zinc-500 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            💡 El local más cercano (<strong>{resultados[0]?.local.nombre}</strong>) es el ideal para este
            cliente
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-4 flex items-center justify-center border border-zinc-200 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 mr-2" />
          <p className="text-sm text-zinc-600">Calculando distancias...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && resultados.length === 0 && coords && (
        <div className="p-4 text-center border border-zinc-200 rounded-lg bg-zinc-50">
          <MapPin className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-600">No hay locales con coordenadas para comparar</p>
        </div>
      )}
    </div>
  )
}
