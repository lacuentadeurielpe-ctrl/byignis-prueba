'use client'

import { Clock } from 'lucide-react'
import { formatearVentanaISO } from '@/lib/delivery/agenda/ventanas'

/**
 * Badge compartido para mostrar la ventana de entrega declarada en cualquier
 * superficie (Ventas, POS, Conversaciones). No renderiza nada si no hay ventana.
 */
export default function VentanaEntregaBadge({
  inicio,
  fin,
  confirmada,
  size = 'sm',
  className = '',
}: {
  inicio?: string | null
  fin?: string | null
  confirmada?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const texto = formatearVentanaISO(inicio, fin)
  if (!texto) return null

  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'
  const tono = confirmada
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} font-medium rounded border ${tono} ${className}`}
      title={confirmada ? 'Ventana confirmada por el repartidor' : 'Ventana provisional (aún no confirmada)'}
    >
      <Clock className={size === 'md' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} />
      {texto}
      {!confirmada && <span className="opacity-60">· provisional</span>}
    </span>
  )
}
