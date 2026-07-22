'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Mientras el pago está en validación, refresca la página sola.
 *
 * La página de gracias es un server component que consulta el estado real a
 * MP en cada carga; con esto el cliente ve la confirmación apenas MP autoriza,
 * sin tener que recargar a mano ni depender de que llegue el webhook.
 *
 * Corta a los 2 minutos para no quedar refrescando indefinidamente.
 */
const INTERVALO_MS = 5_000
const MAX_INTENTOS = 24 // 24 × 5s = 2 minutos

export default function AutoRefrescar({ activo }: { activo: boolean }) {
  const router = useRouter()
  const [intentos, setIntentos] = useState(0)

  useEffect(() => {
    if (!activo || intentos >= MAX_INTENTOS) return
    const t = setTimeout(() => {
      setIntentos((n) => n + 1)
      router.refresh()
    }, INTERVALO_MS)
    return () => clearTimeout(t)
  }, [activo, intentos, router])

  if (!activo) return null

  if (intentos >= MAX_INTENTOS) {
    return (
      <p className="mt-4 text-xs text-zinc-500">
        Está tardando más de lo normal. Puedes cerrar esta página: en cuanto
        Mercado Pago confirme, tu cuenta se activa sola. Si en un rato sigue
        igual, escríbenos por WhatsApp.
      </p>
    )
  }

  return (
    <p className="mt-4 text-xs text-zinc-500">
      Verificando automáticamente… no cierres esta página.
    </p>
  )
}
