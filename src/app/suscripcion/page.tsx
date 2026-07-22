import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hoyLima } from '@/lib/suscripciones/mercadopago'
import CheckoutSuscripcion from './CheckoutSuscripcion'

export const metadata = {
  title: 'Activa tu suscripción | Uintegrus',
}

export const dynamic = 'force-dynamic'

/**
 * Página de pago de la suscripción SaaS (S/ 80/mes, plan único).
 * Requiere sesión (el proxy redirige a login si no la hay).
 */
export default async function SuscripcionPage() {
  const session = await getSessionInfo()
  // Ver comentario equivalente en (dashboard)/layout.tsx: el proxy ya
  // garantiza sesión válida acá — null significa onboarding incompleto.
  if (!session) redirect('/onboarding')

  // Ya está pagando o es vitalicio → no hay nada que hacer aquí
  if (session.estadoSuscripcion === 'activo') redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si el trial sigue vigente, el primer cobro se difiere al fin de la prueba
  let primerCobroDiferido: string | null = null
  if (session.estadoSuscripcion === 'trial') {
    const admin = createAdminClient()
    const { data: susc } = await admin
      .from('suscripciones')
      .select('ciclo_fin')
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle()
    if (susc?.ciclo_fin && susc.ciclo_fin > hoyLima()) {
      primerCobroDiferido = susc.ciclo_fin
    }
  }

  // Acepta cualquiera de los dos nombres — no depende de cómo se subió a Vercel.
  const mpPublicKey =
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? process.env.MP_PUBLIC_KEY ?? ''

  return (
    <CheckoutSuscripcion
      emailDefault={user?.email ?? ''}
      nombreNegocio={session.nombreFerreteria}
      esDueno={session.rol === 'dueno'}
      enTrial={session.estadoSuscripcion === 'trial' && session.suscripcionActiva}
      trialDiasRestantes={session.trialDiasRestantes ?? 0}
      primerCobroDiferido={primerCobroDiferido}
      mpPublicKey={mpPublicKey}
    />
  )
}
