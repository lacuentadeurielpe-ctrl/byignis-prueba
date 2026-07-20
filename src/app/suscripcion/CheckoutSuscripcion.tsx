'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ShieldCheck,
  CreditCard,
  Loader2,
  ArrowLeft,
  Sparkles,
  Lock,
} from 'lucide-react'

const BENEFICIOS = [
  'Facturación electrónica ilimitada (SUNAT)',
  'Asistente de IA en WhatsApp 24/7',
  'Caja POS, inventario y múltiples sucursales',
  'Perfiles para cajeros y administradores',
  'Soporte técnico y actualizaciones incluidas',
]

export default function CheckoutSuscripcion({
  emailDefault,
  nombreNegocio,
  esDueno,
  enTrial,
  trialDiasRestantes,
}: {
  emailDefault: string
  nombreNegocio: string
  esDueno: boolean
  enTrial: boolean
  trialDiasRestantes: number
}) {
  const router = useRouter()
  const [email, setEmail] = useState(emailDefault)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePagar = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/suscripcion/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No pudimos iniciar el pago. Inténtalo de nuevo.')
        setLoading(false)
        return
      }
      // Redirigir al checkout seguro de Mercado Pago
      window.location.href = data.url
    } catch {
      setError('Error de conexión. Revisa tu internet e inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-4 text-zinc-50">
      {/* Fondo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-900/20 to-transparent" />
      <div className="pointer-events-none absolute -top-48 -right-48 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 shadow-2xl backdrop-blur-xl">
          {/* Encabezado del plan */}
          <div className="border-b border-white/10 bg-gradient-to-br from-blue-600/20 to-transparent p-8 text-center">
            {enTrial && (
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                <Sparkles className="h-3.5 w-3.5" />
                {trialDiasRestantes <= 0
                  ? 'Tu prueba termina hoy'
                  : `Prueba gratuita: ${trialDiasRestantes} ${trialDiasRestantes === 1 ? 'día restante' : 'días restantes'}`}
              </span>
            )}
            <h1 className="text-2xl font-bold text-white">Plan Todo Incluido</h1>
            <p className="mt-1 text-sm text-zinc-400">{nombreNegocio}</p>
            <div className="mt-4 flex items-baseline justify-center gap-2">
              <span className="text-xl font-bold text-zinc-500 line-through">S/ 150</span>
              <span className="text-5xl font-extrabold text-white">S/ 85</span>
              <span className="text-zinc-400">/mes</span>
            </div>
            <p className="mt-2 text-sm font-medium text-blue-400">
              Pago fijo mensual · cancela cuando quieras
            </p>
          </div>

          <div className="p-8">
            {/* Beneficios */}
            <div className="mb-8 space-y-3">
              {BENEFICIOS.map((b) => (
                <div key={b} className="flex items-start gap-3">
                  <div className="shrink-0 rounded-full bg-blue-500/10 p-1">
                    <Check className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-sm text-zinc-300">{b}</span>
                </div>
              ))}
            </div>

            {esDueno ? (
              <>
                {/* Email de la cuenta Mercado Pago */}
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Correo de tu cuenta de Mercado Pago
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@gmail.com"
                  className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mb-6 text-xs text-zinc-500">
                  Con este correo iniciarás sesión en Mercado Pago para autorizar el
                  cobro mensual automático.
                </p>

                {error && (
                  <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  onClick={handlePagar}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-lg font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Conectando con Mercado Pago…
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      Suscribirme con Mercado Pago
                    </>
                  )}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
                  <ShieldCheck className="h-4 w-4 text-green-400" />
                  Pago procesado por Mercado Pago. Nunca vemos los datos de tu tarjeta.
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                Solo el dueño del negocio puede activar la suscripción. Pídele que
                ingrese a esta página desde su cuenta.
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-600">
          ¿Prefieres pagar por otro medio?{' '}
          <a
            href="https://wa.me/51980838850?text=Hola%2C%20quiero%20activar%20mi%20suscripci%C3%B3n%20de%20Uintegrus"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 underline transition hover:text-white"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
    </div>
  )
}
