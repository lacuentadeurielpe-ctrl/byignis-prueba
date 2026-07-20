import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { hoyLima, PLAN_SAAS } from '@/lib/suscripciones/mercadopago'
import PanelSuscripcion, { type PagoSaas } from './PanelSuscripcion'

export const metadata = {
  title: 'Suscripción | Uintegrus',
}

export const dynamic = 'force-dynamic'

/**
 * Panel de gestión de la suscripción del tenant: estado, próximo cobro,
 * historial de pagos y acciones (pagar durante el trial / cancelar).
 * El layout del dashboard ya garantiza sesión y suscripción vigente.
 */
export default async function SuscripcionDashboardPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const admin = createAdminClient()

  const [{ data: susc }, { data: pagos }] = await Promise.all([
    admin
      .from('suscripciones')
      .select('estado, ciclo_inicio, ciclo_fin, proximo_cobro, mp_preapproval_id, mp_payer_email')
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle(),
    admin
      .from('pagos_saas')
      .select('id, fecha, monto, moneda, estado')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('fecha', { ascending: false })
      .limit(12),
  ])

  // Si paga durante el trial, el primer cobro se difiere al fin de la prueba
  const primerCobroDiferido =
    session.estadoSuscripcion === 'trial' && susc?.ciclo_fin && susc.ciclo_fin > hoyLima()
      ? susc.ciclo_fin
      : null

  return (
    <PanelSuscripcion
      estado={session.estadoSuscripcion}
      esDueno={session.rol === 'dueno'}
      trialDiasRestantes={session.trialDiasRestantes}
      cicloFin={susc?.ciclo_fin ?? null}
      proximoCobro={susc?.proximo_cobro ?? null}
      mpConectado={!!susc?.mp_preapproval_id && session.estadoSuscripcion === 'activo'}
      mpEmail={susc?.mp_payer_email ?? null}
      primerCobroDiferido={primerCobroDiferido}
      precio={PLAN_SAAS.precio}
      pagos={(pagos ?? []) as PagoSaas[]}
    />
  )
}
