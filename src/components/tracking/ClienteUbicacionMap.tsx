'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { MapPin, Package } from 'lucide-react'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false })
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false })

interface ClienteUbicacionMapProps {
  localOrigen: {
    nombre: string
    lat: number
    lng: number
    direccion: string
  }
  clienteDestino: {
    lat: number
    lng: number
    direccion: string
  }
  distancia?: number
  eta?: number
  estado?: string
}

export default function ClienteUbicacionMap({
  localOrigen,
  clienteDestino,
  distancia,
  eta,
  estado = 'en_preparacion',
}: ClienteUbicacionMapProps) {
  const centerLat = (localOrigen.lat + clienteDestino.lat) / 2
  const centerLng = (localOrigen.lng + clienteDestino.lng) / 2

  const routePoints = useMemo(
    () => [
      [localOrigen.lat, localOrigen.lng] as [number, number],
      [clienteDestino.lat, clienteDestino.lng] as [number, number],
    ],
    [localOrigen, clienteDestino]
  )

  const estadoColor: Record<string, { bg: string; text: string; icon: string }> = {
    en_preparacion: { bg: 'bg-amber-50', text: 'text-amber-700', icon: '⏳' },
    enviado: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '📦' },
    entregado: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✅' },
  }

  const estadoInfo = estadoColor[estado] || estadoColor.en_preparacion

  return (
    <div className="space-y-3">
      {/* Mapa */}
      <div className="w-full h-80 rounded-lg overflow-hidden border border-zinc-200">
        <MapContainer center={[centerLat, centerLng]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          <ZoomControl position="topright" />

          {/* Origen */}
          <Marker position={[localOrigen.lat, localOrigen.lng]}>
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-semibold">📦 {localOrigen.nombre}</p>
                <p className="text-zinc-600">{localOrigen.direccion}</p>
              </div>
            </Popup>
          </Marker>

          {/* Destino */}
          <Marker position={[clienteDestino.lat, clienteDestino.lng]}>
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-semibold">📍 Tu dirección</p>
                <p className="text-zinc-600">{clienteDestino.direccion}</p>
              </div>
            </Popup>
          </Marker>

          {/* Línea conectando */}
          <Polyline
            positions={routePoints}
            color="rgb(59, 130, 246)"
            weight={3}
            opacity={0.7}
            dashArray="5, 5"
          />
        </MapContainer>
      </div>

      {/* Info */}
      <div className={`p-3 rounded-lg border ${estadoInfo.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{estadoInfo.icon}</span>
            <p className={`text-sm font-medium ${estadoInfo.text}`}>
              {estado === 'en_preparacion' && 'Preparando tu pedido'}
              {estado === 'enviado' && 'En camino'}
              {estado === 'entregado' && 'Entregado'}
            </p>
          </div>
        </div>

        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span className="text-zinc-600">De: <span className="font-medium text-zinc-900">{localOrigen.nombre}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="text-zinc-600">A: <span className="font-medium text-zinc-900">Tu dirección</span></span>
          </div>
        </div>

        {(distancia || eta) && (
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-opacity-20">
            {distancia && (
              <div>
                <p className="text-xs font-medium text-zinc-600">Distancia</p>
                <p className={`text-sm font-bold ${estadoInfo.text}`}>{distancia.toFixed(1)} km</p>
              </div>
            )}
            {eta && (
              <div>
                <p className="text-xs font-medium text-zinc-600">ETA Aprox.</p>
                <p className={`text-sm font-bold ${estadoInfo.text}`}>{eta} min</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="text-xs text-zinc-600 p-2 bg-zinc-50 rounded-lg border border-zinc-200">
        <p className="font-medium text-zinc-700 mb-1">💡 Consejos:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Asegúrate de tener el acceso disponible</li>
          <li>Ten listos los documentos de identidad</li>
          <li>Verifica tu teléfono para confirmación</li>
        </ul>
      </div>
    </div>
  )
}
