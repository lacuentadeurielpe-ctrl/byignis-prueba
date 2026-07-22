import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react'
import { getSessionInfo } from '@/lib/auth/roles'
import {
  sincronizarPreapproval,
  suscripcionesMPConfigurado,
} from '@/lib/suscripciones/mercadopago'

export const metadata = {
  title: 'Confirmación de suscripción | Uintegrus',
}

export const dynamic = 'force-dynamic'

/**
 * back_url del checkout de Mercado Pago. MP redirige aquí con
 * ?preapproval_id=... — verificamos el estado real contra la API de MP
 * (sin esperar al webhook) y activamos la cuenta al instante.
 */
export default async function GraciasPage({
  searchParams,
}: {
  searchParams: Promise<{ preapproval_id?: string }>
}) {
  const session = await getSessionInfo()
  // Ver comentario equivalente en (dashboard)/layout.tsx: el proxy ya
  // garantiza sesión válida acá — null significa onboarding incompleto.
  if (!session) redirect('/onboarding')

  const { preapproval_id: preapprovalId } = await searchParams

  let status: 'authorized' | 'pending' | 'fallo' = 'pending'

  if (preapprovalId && suscripcionesMPConfigurado()) {
    try {
      const res = await sincronizarPreapproval(preapprovalId)
      if (res.status === 'authorized') status = 'authorized'
      else if (res.status === 'cancelled') status = 'fallo'
    } catch (err) {
      console.error('[suscripcion/gracias]', err)
      // se queda en 'pending': el webhook terminará de reconciliar
    }
  }

  const contenido = {
    authorized: {
      icono: <CheckCircle2 className="h-10 w-10 text-green-400" />,
      halo: 'bg-green-500/10 border-green-500/20',
      titulo: '¡Suscripción activada!',
      texto: `${session.nombreFerreteria} ya tiene el Plan Todo Incluido. El cobro de S/ 80 se realizará automáticamente cada mes.`,
    },
    pending: {
      icono: <Clock className="h-10 w-10 text-blue-400" />,
      halo: 'bg-blue-500/10 border-blue-500/20',
      titulo: 'Procesando tu pago…',
      texto: 'Mercado Pago está confirmando la operación. Tu cuenta se activará automáticamente en unos minutos — no necesitas hacer nada más.',
    },
    fallo: {
      icono: <XCircle className="h-10 w-10 text-red-400" />,
      halo: 'bg-red-500/10 border-red-500/20',
      titulo: 'El pago no se completó',
      texto: 'La suscripción fue cancelada o rechazada. Puedes intentarlo de nuevo con otro medio de pago.',
    },
  }[status]

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-4 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-900/20 to-transparent" />
      <div className="pointer-events-none absolute -top-48 -right-48 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border ${contenido.halo}`}
          >
            {contenido.icono}
          </div>

          <h1 className="mb-3 text-2xl font-bold text-white sm:text-3xl">
            {contenido.titulo}
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {contenido.texto}
          </p>

          {status === 'fallo' ? (
            <Link
              href="/suscripcion"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3.5 font-bold text-white transition-all hover:from-blue-400 hover:to-blue-500"
            >
              Intentar de nuevo
              <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3.5 font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
            >
              Ir a mi panel
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
