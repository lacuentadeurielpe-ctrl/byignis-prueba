import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import CheckoutSuscripcion from './CheckoutSuscripcion'

export const metadata = {
  title: 'Activa tu suscripción | Uintegrus',
}

export const dynamic = 'force-dynamic'

/**
 * Página de pago de la suscripción SaaS (S/ 85/mes, plan único).
 * Requiere sesión (el proxy redirige a login si no la hay).
 */
export default async function SuscripcionPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  // Ya está pagando o es vitalicio → no hay nada que hacer aquí
  if (session.estadoSuscripcion === 'activo') redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <CheckoutSuscripcion
      emailDefault={user?.email ?? ''}
      nombreNegocio={session.nombreFerreteria}
      esDueno={session.rol === 'dueno'}
      enTrial={session.estadoSuscripcion === 'trial' && session.suscripcionActiva}
      trialDiasRestantes={session.trialDiasRestantes ?? 0}
    />
  )
}
