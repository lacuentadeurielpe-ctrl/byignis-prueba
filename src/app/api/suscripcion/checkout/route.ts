/**
 * POST /api/suscripcion/checkout
 *
 * Crea la suscripción (preapproval) de Mercado Pago para el tenant del
 * usuario autenticado y devuelve la URL del checkout seguro de MP.
 * Solo el dueño puede suscribir su negocio.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { crearSuscripcionMP, suscripcionesMPConfigurado } from '@/lib/suscripciones/mercadopago'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!suscripcionesMPConfigurado()) {
    return NextResponse.json(
      { error: 'El pago en línea no está disponible por el momento. Escríbenos por WhatsApp.' },
      { status: 503 }
    )
  }

  const session = await getSessionInfo()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.rol !== 'dueno') {
    return NextResponse.json(
      { error: 'Solo el dueño del negocio puede activar la suscripción.' },
      { status: 403 }
    )
  }
  if (session.estadoSuscripcion === 'activo') {
    return NextResponse.json({ error: 'Tu suscripción ya está activa.' }, { status: 400 })
  }

  let email = ''
  try {
    const body = await request.json()
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    // body vacío → se valida abajo
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Ingresa un correo válido (el de tu cuenta de Mercado Pago).' },
      { status: 400 }
    )
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(request.url).origin

  try {
    const { preapprovalId, initPoint } = await crearSuscripcionMP({
      ferreteriaId: session.ferreteriaId,
      payerEmail:   email,
      baseUrl,
    })

    // Guardar el intento en la suscripción (si existe fila) para reconciliar.
    const admin = createAdminClient()
    await admin
      .from('suscripciones')
      .update({
        mp_preapproval_id: preapprovalId,
        mp_payer_email:    email,
        updated_at:        new Date().toISOString(),
      })
      .eq('ferreteria_id', session.ferreteriaId)

    return NextResponse.json({ url: initPoint })
  } catch (err) {
    console.error('[suscripcion/checkout]', err)
    const msg = err instanceof Error ? err.message : ''
    // MP rechaza el checkout si el email pertenece a la misma cuenta que cobra
    if (msg.includes('payer') && msg.includes('collector')) {
      return NextResponse.json(
        { error: 'Ese correo pertenece a la cuenta que cobra. Usa el correo de TU cuenta personal de Mercado Pago.' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'No pudimos iniciar el pago. Inténtalo de nuevo o escríbenos por WhatsApp.' },
      { status: 502 }
    )
  }
}
