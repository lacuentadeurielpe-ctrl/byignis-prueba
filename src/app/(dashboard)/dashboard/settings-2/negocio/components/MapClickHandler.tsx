'use client'

import { useMapEvents } from 'react-leaflet'

interface MapClickHandlerProps {
  markerPosition: [number, number] | null
  setMarkerPosition: (pos: [number, number]) => void
  onMapClick: (lat: number, lng: number) => void
}

export default function MapClickHandler({
  markerPosition,
  setMarkerPosition,
  onMapClick,
}: MapClickHandlerProps) {
  const map = useMapEvents({
    click: (e: any) => {
      const { lat, lng } = e.latlng
      setMarkerPosition([lat, lng])
      onMapClick(lat, lng)
    },
  })

  return null
}
