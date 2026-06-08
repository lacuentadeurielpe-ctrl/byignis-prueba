'use client'

import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'
import type { Local } from '@/types/locales'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false })

interface LocalDetailMapProps {
  local: Local
}

export default function LocalDetailMap({ local }: LocalDetailMapProps) {
  if (!local.lat || !local.lng) {
    return (
      <div className="w-full h-64 bg-zinc-100 rounded-lg flex items-center justify-center border border-zinc-200">
        <div className="text-center">
          <MapPin className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-600">Sin coordenadas</p>
          <p className="text-xs text-zinc-500">Edita el local para obtenerlas de Google Maps</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="w-full h-64 rounded-lg overflow-hidden border border-zinc-200">
        <MapContainer
          center={[local.lat, local.lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          <ZoomControl position="topright" />
          <Marker position={[local.lat, local.lng]} />
        </MapContainer>
      </div>

      {/* Coords */}
      <div className="text-xs text-zinc-500 space-y-1 p-2 bg-zinc-50 rounded-lg">
        <p>
          <span className="font-medium">Latitud:</span> {local.lat.toFixed(6)}
        </p>
        <p>
          <span className="font-medium">Longitud:</span> {local.lng.toFixed(6)}
        </p>
        {local.place_id && (
          <p>
            <span className="font-medium">Place ID:</span> {local.place_id.slice(0, 20)}...
          </p>
        )}
      </div>
    </div>
  )
}
