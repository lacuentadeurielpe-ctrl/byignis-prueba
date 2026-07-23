'use client'

/**
 * Formulario de prueba de pago (superadmin). Misma tokenización de tarjeta que
 * el checkout de suscripciones (MP CardForm), pero cobra un pago ÚNICO de S/2
 * vía /api/superadmin/prueba-pago y muestra el resultado con el tipo de tarjeta
 * detectado (crédito/débito). No crea suscripción ni toca accesos.
 */

import { useEffect, useRef, useState } from 'react'
import { CreditCard, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface Resultado {
  ok: boolean
  status: string
  statusDetail: string
  tipo: string
  medio: string
  monto: number
  mensaje: string
}

export default function PruebaPagoForm({ mpPublicKey }: { mpPublicKey: string }) {
  const [sdkListo, setSdkListo]     = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [resultado, setResultado]   = useState<Resultado | null>(null)
  const cardFormRef = useRef<{ getCardFormData: () => Record<string, string>; unmount?: () => void } | null>(null)
  const procesandoRef = useRef(false)

  useEffect(() => {
    if (!mpPublicKey) return
    let cancelado = false

    const iniciar = () => {
      if (cancelado || cardFormRef.current) return
      try {
        const MercadoPago = (window as unknown as { MercadoPago: new (k: string, o?: object) => { cardForm: (c: object) => never } }).MercadoPago
        const mp = new MercadoPago(mpPublicKey, { locale: 'es-PE' })

        cardFormRef.current = mp.cardForm({
          amount: '2',
          iframe: true,
          form: {
            id: 'mp-form-prueba',
            cardNumber:           { id: 'p-cardNumber', placeholder: 'Número de tarjeta' },
            expirationDate:       { id: 'p-expiration', placeholder: 'MM/YY' },
            securityCode:         { id: 'p-cvc',        placeholder: 'CVV' },
            cardholderName:       { id: 'p-name',       placeholder: 'Titular de la tarjeta' },
            issuer:               { id: 'p-issuer' },
            installments:         { id: 'p-installments' },
            identificationType:   { id: 'p-docType' },
            identificationNumber: { id: 'p-docNumber',  placeholder: 'Número de documento' },
            cardholderEmail:      { id: 'p-email',      placeholder: 'tucorreo@gmail.com' },
          },
          callbacks: {
            onFormMounted: (err: unknown) => {
              if (err) { setError('No se pudo cargar el formulario. Recarga la página.'); return }
              setSdkListo(true)
            },
            onSubmit: async (event: Event) => {
              event.preventDefault()
              if (procesandoRef.current) return
              procesandoRef.current = true
              setProcesando(true)
              setError(null)
              setResultado(null)

              const data = cardFormRef.current?.getCardFormData() ?? {}
              if (!data.token) {
                setError('Revisa los datos de la tarjeta: hay campos incompletos o inválidos.')
                setProcesando(false); procesandoRef.current = false
                return
              }

              try {
                const res = await fetch('/api/superadmin/prueba-pago', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cardTokenId:     data.token,
                    paymentMethodId: data.paymentMethodId,
                    email:           data.cardholderEmail || '',
                  }),
                })
                const json = await res.json()
                if (!res.ok) {
                  setError(json.error ?? 'No se pudo procesar el pago.')
                } else {
                  setResultado(json as Resultado)
                }
              } catch {
                setError('Error de conexión. Inténtalo de nuevo.')
              } finally {
                setProcesando(false); procesandoRef.current = false
              }
            },
          },
        })
      } catch {
        setError('No se pudo cargar Mercado Pago. Recarga la página.')
      }
    }

    if ((window as unknown as { MercadoPago?: unknown }).MercadoPago) {
      iniciar()
    } else {
      const script = document.createElement('script')
      script.src = 'https://sdk.mercadopago.com/js/v2'
      script.async = true
      script.onload = iniciar
      script.onerror = () => setError('No se pudo cargar Mercado Pago. Revisa tu conexión.')
      document.body.appendChild(script)
    }

    return () => {
      cancelado = true
      try { cardFormRef.current?.unmount?.() } catch { /* noop */ }
      cardFormRef.current = null
    }
  }, [mpPublicKey])

  if (!mpPublicKey) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        Falta configurar NEXT_PUBLIC_MP_PUBLIC_KEY en el servidor.
      </div>
    )
  }

  const inputClase =
    'w-full rounded-lg border border-gray-700 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500'
  const iframeClase = 'h-[42px] w-full overflow-hidden rounded-lg border border-gray-700 bg-white px-2'

  // ── Resultado del pago ──
  if (resultado) {
    const Icono = resultado.status === 'approved' ? CheckCircle2
      : resultado.status === 'rejected' ? XCircle : Clock
    const color = resultado.status === 'approved' ? 'text-emerald-400'
      : resultado.status === 'rejected' ? 'text-red-400' : 'text-amber-400'

    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Icono className={`w-8 h-8 ${color}`} />
          <div>
            <p className="font-semibold text-white">{resultado.mensaje}</p>
            <p className="text-xs text-gray-500">Estado MP: {resultado.status} · {resultado.statusDetail}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
            <p className="text-xs text-gray-500 uppercase">Tipo de tarjeta</p>
            <p className="font-semibold text-white mt-0.5">{resultado.tipo}</p>
          </div>
          <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
            <p className="text-xs text-gray-500 uppercase">Medio</p>
            <p className="font-semibold text-white mt-0.5 capitalize">{resultado.medio}</p>
          </div>
        </div>

        <button
          onClick={() => { setResultado(null); setError(null) }}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 text-sm transition-colors"
        >
          Hacer otra prueba
        </button>
      </div>
    )
  }

  return (
    <form id="mp-form-prueba" className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
      {!sdkListo && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando formulario seguro…
        </div>
      )}

      <div className={sdkListo ? 'space-y-4' : 'invisible h-0 overflow-hidden'}>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Número de tarjeta</label>
          <div id="p-cardNumber" className={iframeClase} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Vencimiento</label>
            <div id="p-expiration" className={iframeClase} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">CVV</label>
            <div id="p-cvc" className={iframeClase} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Titular</label>
          <input id="p-name" className={inputClase} />
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Doc.</label>
            <select id="p-docType" className={inputClase} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Número</label>
            <input id="p-docNumber" className={inputClase} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Correo</label>
          <input id="p-email" type="email" className={inputClase} />
        </div>

        <select id="p-issuer" className="hidden" />
        <select id="p-installments" className="hidden" />

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={procesando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors"
        >
          {procesando
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Cobrando S/ 2…</>
            : <><CreditCard className="w-4 h-4" /> Cobrar S/ 2 de prueba</>}
        </button>
      </div>
    </form>
  )
}
