'use client'

import { Clock } from 'lucide-react'
import { formatearETADesdeISO } from '@/lib/delivery/eta-simple'

/**
 * Badge compartido para mostrar el ETA de entrega en cualquier superficie
 * (Ventas, POS, Conversaciones). No renderiza nada si no hay ETA.
 */
export default function VentanaEntregaBadge({
  etaTimestamp,
  size = 'sm',
  className = '',
}: {
  etaTimestamp?: string | null
  size?: 'sm' | 'md'
  className?: string
  // Props legacy de la ventana — ignorados, compatibilidad durante transición
  inicio?: string | null
  fin?: string | null
  confirmada?: boolean
}) {
  const texto = formatearETADesdeISO(etaTimestamp)
  if (!texto) return null

  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} font-medium rounded border bg-sky-50 text-sky-700 border-sky-200 ${className}`}
      title="ETA estimado de entrega"
    >
      <Clock className={size === 'md' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} />
      ~{texto}
    </span>
  )
}
