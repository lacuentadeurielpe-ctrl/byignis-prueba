import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

/**
 * Banner fijo durante la prueba gratuita de 3 días.
 * Solo el dueño ve el CTA de pago (los vendedores no pueden suscribir).
 */
export default function TrialBanner({
  diasRestantes,
  esDueno,
}: {
  diasRestantes: number
  esDueno: boolean
}) {
  const texto =
    diasRestantes <= 0
      ? 'Tu prueba gratuita termina hoy'
      : diasRestantes === 1
        ? 'Te queda 1 día de prueba gratuita'
        : `Te quedan ${diasRestantes} días de prueba gratuita`

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-sm text-white shadow-md">
      <Sparkles className="h-4 w-4 shrink-0" />
      <span className="font-medium">{texto}</span>
      {esDueno && (
        <Link
          href="/suscripcion"
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-semibold transition hover:bg-white/25"
        >
          Suscribirme — S/ 85/mes
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
