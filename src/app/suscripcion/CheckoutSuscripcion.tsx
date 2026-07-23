'use client'

/**
 * Checkout embebido de la suscripción (S/ 80/mes).
 *
 * La tarjeta se ingresa AQUÍ MISMO: los campos sensibles (número, vencimiento,
 * CVV) son iframes seguros del SDK de Mercado Pago — los datos viajan cifrados
 * directo a MP con la Public Key y nunca tocan nuestro servidor. El token
 * resultante se envía a /api/suscripcion/checkout, que autoriza el cobro
 * recurrente sin redirección.
 *
 * Requiere la Public Key de MP (prop `mpPublicKey`, la resuelve el server
 * component desde NEXT_PUBLIC_MP_PUBLIC_KEY o MP_PUBLIC_KEY). Si falta, se
 * muestra solo el flujo alterno (redirección al checkout de MP).
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ShieldCheck,
  CreditCard,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react'

const BENEFICIOS = [
  'Facturación electrónica ilimitada (SUNAT)',
  'Asistente de IA en WhatsApp 24/7',
  'Caja POS, inventario y múltiples sucursales',
  'Soporte técnico y actualizaciones incluidas',
]

function formatearFecha(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function CheckoutSuscripcion({
  emailDefault,
  nombreNegocio,
  esDueno,
  enTrial,
  trialDiasRestantes,
  primerCobroDiferido,
  mpPublicKey,
}: {
  emailDefault: string
  nombreNegocio: string
  esDueno: boolean
  enTrial: boolean
  trialDiasRestantes: number
  primerCobroDiferido: string | null
  /** Public Key de MP (no es secreta) — la pasa el server para no depender del prefijo NEXT_PUBLIC_. */
  mpPublicKey: string
}) {
  const MP_PUBLIC_KEY = mpPublicKey
  const router = useRouter()
  const [sdkListo, setSdkListo]     = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  // Cuando la tarjeta es rechazada (típico: antifraude de MP), se ofrece
  // continuar en la página de Mercado Pago, donde el pago suele pasar y la
  // activación sigue siendo automática (lleva el external_reference).
  const [ofrecerRescate, setOfrecerRescate] = useState(false)
  const cardFormRef = useRef<{ getCardFormData: () => { token?: string; cardholderEmail?: string }; unmount?: () => void } | null>(null)
  const procesandoRef = useRef(false)

  const conFormularioEmbebido = !!MP_PUBLIC_KEY && esDueno

  // ── Inicializar SDK + CardForm de Mercado Pago ──────────────────────────
  useEffect(() => {
    if (!conFormularioEmbebido) return

    let cancelado = false

    const iniciar = () => {
      if (cancelado || cardFormRef.current) return
      try {
        const MercadoPago = (window as unknown as { MercadoPago: new (k: string, o?: object) => { cardForm: (c: object) => never } }).MercadoPago
        const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' })

        cardFormRef.current = mp.cardForm({
          amount: '80',
          iframe: true,
          form: {
            id: 'mp-form',
            cardNumber:           { id: 'mp-cardNumber', placeholder: 'Número de tarjeta' },
            expirationDate:       { id: 'mp-expiration', placeholder: 'MM/YY' },
            securityCode:         { id: 'mp-cvc',        placeholder: 'CVV' },
            cardholderName:       { id: 'mp-name',       placeholder: 'Nombre como figura en la tarjeta' },
            issuer:               { id: 'mp-issuer' },
            installments:         { id: 'mp-installments' },
            identificationType:   { id: 'mp-docType' },
            identificationNumber: { id: 'mp-docNumber',  placeholder: 'Número de documento' },
            cardholderEmail:      { id: 'mp-email',      placeholder: 'tucorreo@gmail.com' },
          },
          callbacks: {
            onFormMounted: (err: unknown) => {
              if (err) {
                console.error('[MP cardForm mount]', err)
                setError('No pudimos cargar el formulario de pago. Recarga la página.')
                return
              }
              setSdkListo(true)
            },
            onSubmit: async (event: Event) => {
              event.preventDefault()
              if (procesandoRef.current) return
              procesandoRef.current = true
              setProcesando(true)
              setError(null)

              const data = cardFormRef.current?.getCardFormData() ?? {}
              if (!data.token) {
                setError('Revisa los datos de tu tarjeta: hay campos incompletos o inválidos.')
                setProcesando(false)
                procesandoRef.current = false
                return
              }

              try {
                const res = await fetch('/api/suscripcion/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email:       data.cardholderEmail || '',
                    cardTokenId: data.token,
                  }),
                })
                const json = await res.json()

                // Si el preapproval existe (autorizado O pendiente), la página
                // de gracias resuelve el estado real. Solo se muestra error
                // acá cuando no se llegó a crear nada — así el cliente nunca
                // paga dos veces creyendo que el primer intento falló.
                if (json.preapprovalId) {
                  window.location.href = `/suscripcion/gracias?preapproval_id=${json.preapprovalId}`
                  return
                }

                setError(json.error ?? 'No pudimos procesar el pago. Intenta de nuevo.')
                // La tarjeta fue rechazada → ofrecer la vía de Mercado Pago
                setOfrecerRescate(true)
                setProcesando(false)
                procesandoRef.current = false
              } catch {
                setError('Error de conexión. Revisa tu internet e inténtalo de nuevo.')
                setProcesando(false)
                procesandoRef.current = false
              }
            },
          },
        })
      } catch (e) {
        console.error('[MP SDK init]', e)
        setError('No pudimos cargar el formulario de pago. Recarga la página.')
      }
    }

    if ((window as unknown as { MercadoPago?: unknown }).MercadoPago) {
      iniciar()
    } else {
      const script = document.createElement('script')
      script.src = 'https://sdk.mercadopago.com/js/v2'
      script.async = true
      script.onload = iniciar
      script.onerror = () => setError('No pudimos cargar Mercado Pago. Revisa tu conexión y recarga.')
      document.body.appendChild(script)
    }

    return () => {
      cancelado = true
      try { cardFormRef.current?.unmount?.() } catch { /* noop */ }
      cardFormRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conFormularioEmbebido])

  // ── Flujo alterno: checkout en la web de MP (requiere cuenta MP) ────────
  const pagarConCuentaMP = async () => {
    // El estado de React tarda un tick en aplicarse; el ref bloquea el doble
    // clic de inmediato para no disparar dos cobros.
    if (procesandoRef.current) return
    procesandoRef.current = true
    setError(null)
    setProcesando(true)

    const liberar = () => {
      setProcesando(false)
      procesandoRef.current = false
    }

    try {
      const emailInput = document.getElementById('mp-email') as HTMLInputElement | null
      const email = emailInput?.value?.trim() || emailDefault
      const res = await fetch('/api/suscripcion/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No pudimos iniciar el pago. Inténtalo de nuevo.')
        liberar()
        return
      }
      window.location.href = data.url
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      liberar()
    }
  }

  const inputClase =
    'w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20'
  const iframeClase =
    'h-[46px] w-full overflow-hidden rounded-xl border border-white/10 bg-white px-2'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-4 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-900/20 to-transparent" />
      <div className="pointer-events-none absolute -top-48 -right-48 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 shadow-2xl backdrop-blur-xl">
          {/* Encabezado del plan */}
          <div className="border-b border-white/10 bg-gradient-to-br from-blue-600/20 to-transparent p-6 text-center sm:p-8">
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
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-xl font-bold text-zinc-500 line-through">S/ 120</span>
              <span className="text-5xl font-extrabold text-white">S/ 80</span>
              <span className="text-zinc-400">/mes</span>
            </div>
            {primerCobroDiferido ? (
              <p className="mx-auto mt-3 max-w-sm rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs text-green-300">
                Tus días de prueba se respetan: autorizas hoy y el primer cobro será
                recién el <strong>{formatearFecha(primerCobroDiferido)}</strong>. Desde
                ahí se cobra una vez al mes.
              </p>
            ) : (
              <p className="mt-2 text-sm font-medium text-blue-400">
                Pago fijo mensual · cancela cuando quieras
              </p>
            )}
          </div>

          <div className="p-6 sm:p-8">
            {/* Beneficios compactos */}
            <div className="mb-6 grid gap-2 sm:grid-cols-2">
              {BENEFICIOS.map((b) => (
                <div key={b} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  <span className="text-xs text-zinc-300">{b}</span>
                </div>
              ))}
            </div>

            {!esDueno ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                Solo el dueño del negocio puede activar la suscripción. Pídele que
                ingrese a esta página desde su cuenta.
              </div>
            ) : conFormularioEmbebido ? (
              <form id="mp-form" className="space-y-4">
                {!sdkListo && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando formulario seguro…
                  </div>
                )}

                <div className={sdkListo ? 'space-y-4' : 'invisible h-0 space-y-4 overflow-hidden'}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                      Número de tarjeta
                    </label>
                    <div id="mp-cardNumber" className={iframeClase} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                        Vencimiento
                      </label>
                      <div id="mp-expiration" className={iframeClase} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                        CVV
                      </label>
                      <div id="mp-cvc" className={iframeClase} />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                      Titular de la tarjeta
                    </label>
                    <input id="mp-name" className={inputClase} />
                  </div>

                  <div className="grid grid-cols-[110px_1fr] gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                        Documento
                      </label>
                      <select id="mp-docType" className={inputClase} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                        Número
                      </label>
                      <input id="mp-docNumber" className={inputClase} />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                      Correo electrónico
                    </label>
                    <input id="mp-email" type="email" defaultValue={emailDefault} className={inputClase} />
                  </div>

                  {/* Requeridos por el SDK, sin uso visible en suscripciones */}
                  <select id="mp-issuer" className="hidden" />
                  <select id="mp-installments" className="hidden" />

                  {/* El error suelto solo cuando NO hay rescate — si lo hay, el
                      mensaje va como título del panel para no duplicarlo. */}
                  {error && !ofrecerRescate && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {/* Rescate tras rechazo de tarjeta: continuar en Mercado Pago.
                      Se presenta como la opción MÁS confiable (marca MP), no como
                      un plan B sospechoso. Ahí el cliente paga con su cuenta,
                      Yape u otra tarjeta, y muchos rechazos del formulario pasan. */}
                  {ofrecerRescate ? (
                    <div className="space-y-3 rounded-xl border border-[#009EE3]/30 bg-[#009EE3]/5 p-4">
                      {/* El "qué pasó" — da el motivo de continuar en MP */}
                      <p className="text-sm font-semibold text-white">
                        {error ?? 'No se pudo procesar tu tarjeta aquí.'}
                      </p>
                      <p className="text-sm text-zinc-300">
                        No te preocupes, es normal. Completa tu pago de forma segura en{' '}
                        <strong className="text-white">Mercado Pago</strong>, con tu cuenta, Yape o la misma tarjeta.
                      </p>
                      <button
                        type="button"
                        onClick={pagarConCuentaMP}
                        disabled={procesando}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] px-6 py-4 text-lg font-bold text-white shadow-[0_0_20px_rgba(0,158,227,0.35)] transition-all hover:bg-[#0089c7] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {procesando ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Redirigiendo a Mercado Pago…
                          </>
                        ) : (
                          <>
                            Continuar con Mercado Pago
                            <ArrowRight className="h-5 w-5" />
                          </>
                        )}
                      </button>
                      <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#009EE3]" />
                        Pago protegido por Mercado Pago
                      </div>
                      <button
                        type="button"
                        onClick={() => { setOfrecerRescate(false); setError(null) }}
                        className="w-full text-center text-xs text-zinc-500 underline transition hover:text-zinc-300"
                      >
                        Prefiero intentar con otra tarjeta
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="submit"
                        disabled={procesando}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-lg font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {procesando ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Procesando pago…
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-5 w-5" />
                            {primerCobroDiferido ? 'Autorizar suscripción' : 'Pagar S/ 80 y activar'}
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                        <ShieldCheck className="h-4 w-4 text-green-400" />
                        Datos cifrados y procesados por Mercado Pago. Nunca vemos tu tarjeta.
                      </div>

                      <p className="text-center text-xs text-zinc-600">
                        ¿Prefieres pagar desde tu cuenta de Mercado Pago?{' '}
                        <button
                          type="button"
                          onClick={pagarConCuentaMP}
                          disabled={procesando}
                          className="text-zinc-400 underline transition hover:text-white"
                        >
                          Hazlo aquí
                        </button>
                      </p>
                    </>
                  )}
                </div>
              </form>
            ) : (
              /* Sin Public Key configurada: solo flujo con redirección */
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Correo de tu cuenta de Mercado Pago
                  </label>
                  <input id="mp-email" type="email" defaultValue={emailDefault} className={inputClase} />
                </div>
                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}
                <button
                  onClick={pagarConCuentaMP}
                  disabled={procesando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-lg font-bold text-white transition-all hover:from-blue-400 hover:to-blue-500 disabled:opacity-60"
                >
                  {procesando ? (
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
