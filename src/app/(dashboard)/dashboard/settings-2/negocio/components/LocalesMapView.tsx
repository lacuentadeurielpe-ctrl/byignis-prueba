'use client'

import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'
import { MapPin, Star } from 'lucide-react'
import type { Local } from '@/types/locales'

// Leaflet - no SSR
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false })

interface LocalesMapViewProps {
  locales: Local[]
  zoom?: number
}

export default function LocalesMapView({ locales, zoom = 12 }: LocalesMapViewProps) {
  const [showInactive, setShowInactive] = useState(true)
  const [showActive, setShowActive] = useState(true)

  const filteredLocales = useMemo(() => {
    return locales.filter(l => {
      if (!l.lat || !l.lng) return false
      if (l.es_principal || l.activo) return showActive
      return showInactive
    })
  }, [locales, showActive, showInactive])

  if (filteredLocales.length === 0) {
    return (
      <div className="w-full h-96 bg-zinc-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-600">
            {locales.length === 0
              ? 'No hay locales con coordenadas'
              : 'Activa los filtros para ver los locales'}
          </p>
        </div>
      </div>
    )
  }

  // Calcular centro y bounds
  const lats = filteredLocales.map(l => l.lat!).filter(Boolean)
  const lngs = filteredLocales.map(l => l.lng!).filter(Boolean)
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-2">
        <label className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
          <input
            type="checkbox"
            checked={showActive}
            onChange={e => setShowActive(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs font-medium text-indigo-700">Activos</span>
        </label>
        <label className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs font-medium text-zinc-600">Inactivos</span>
        </label>
      </div>

      {/* Mapa */}
      <div className="w-full h-96 rounded-lg overflow-hidden border border-zinc-200">
        <MapContainer center={[centerLat, centerLng]} zoom={zoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ZoomControl position="topright" />

          {filteredLocales.map(local => {
            const isActive = local.activo && !local.es_principal
            const isPrincipal = local.es_principal
            const isInactive = !local.activo

            // Color del marker según estado
            let iconColor = 'rgb(29, 78, 216)' // azul
            let iconHTML = '📍'

            if (isPrincipal) {
              iconColor = 'rgb(180, 83, 9)' // ámbar/dorado
              iconHTML = '⭐'
            } else if (isInactive) {
              iconColor = 'rgb(113, 113, 122)' // gris
              iconHTML = '📍'
            }

            return (
              <Marker key={local.id} position={[local.lat!, local.lng!]}>
                <Popup maxWidth={280}>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      {isPrincipal && <Star className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />}
                      <div>
                        <h4 className="font-semibold text-zinc-900">{local.nombre}</h4>
                        {local.codigo && <p className="text-xs text-zinc-500">Código: {local.codigo}</p>}
                      </div>
                    </div>

                    <div className="text-xs space-y-1 text-zinc-600 border-t border-zinc-200 pt-2">
                      <p className="font-medium">
                        {local.lat?.toFixed(4)}, {local.lng?.toFixed(4)}
                      </p>
                      <p>{local.direccion}</p>
                      {local.telefono && <p>📞 {local.telefono}</p>}
                      {local.horario_apertura && (
                        <p>🕐 {local.horario_apertura} – {local.horario_cierre}</p>
                      )}
                    </div>

                    <div className="flex gap-1 pt-2">
                      {isPrincipal && (
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                          Principal
                        </span>
                      )}
                      {isInactive && (
                        <span className="inline-block px-2 py-0.5 bg-zinc-100 text-zinc-600 text-xs font-semibold rounded">
                          Inactivo
                        </span>
                      )}
                      {isActive && (
                        <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">
                          Activo
                        </span>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* Leyenda */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <span className="text-zinc-600">Principal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">📍</span>
          <span className="text-zinc-600">Activo</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg opacity-50">📍</span>
          <span className="text-zinc-600">Inactivo</span>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-zinc-500 p-2 bg-zinc-50 rounded-lg">
        Mostrando {filteredLocales.length} de {locales.length} locales
      </div>
    </div>
  )
}
