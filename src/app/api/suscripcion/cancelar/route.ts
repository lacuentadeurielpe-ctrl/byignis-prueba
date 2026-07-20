/**
 * POST /api/suscripcion/cancelar
 *
 * Cancela la suscripción de Mercado Pago del tenant. Solo el dueño.
 * Tras cancelar en MP se sincroniza el estado (→ 'suspendido'): el acceso
 * se pierde de inmediato — la UI lo advierte antes de confirmar.
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  cancelarPreapproval,
  sincronizarPreapproval,
  suscripcionesMPConfigurado,
} from '@/lib/suscripciones/mercadopago'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (!suscripcionesMPConfigurado()) {
    return NextResponse.json({ error: 'Pago en línea no disponible' }, { status: 503 })
  }

  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.rol !== 'dueno') {
    return NextResponse.json(
      { error: 'Solo el dueño puede cancelar la suscripción.' },
      { status: 403 }
    )
  }

  const admin = createAdminClient()
  const { data: susc } = await admin
    .from('suscripciones')
    .select('mp_preapproval_id, estado')
    .eq('ferreteria_id', session.ferreteriaId)
    .maybeSingle()

  if (!susc?.mp_preapproval_id) {
    return NextResponse.json(
      { error: 'No hay una suscripción de Mercado Pago activa para cancelar.' },
      { status: 400 }
    )
  }

  try {
    await cancelarPreapproval(susc.mp_preapproval_id)
    await sincronizarPreapproval(susc.mp_preapproval_id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[suscripcion/cancelar]', err)
    return NextResponse.json(
      { error: 'No pudimos cancelar. Inténtalo de nuevo o escríbenos por WhatsApp.' },
      { status: 502 }
    )
  }
}
