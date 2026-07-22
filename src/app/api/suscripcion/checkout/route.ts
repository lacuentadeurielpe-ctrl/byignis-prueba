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
import {
  crearSuscripcionMP,
  sincronizarPreapproval,
  limpiarPreapprovalPrevio,
  suscripcionesMPConfigurado,
  hoyLima,
} from '@/lib/suscripciones/mercadopago'

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
  let cardTokenId: string | null = null
  try {
    const body = await request.json()
    email = String(body?.email ?? '').trim().toLowerCase()
    cardTokenId = body?.cardTokenId ? String(body.cardTokenId) : null
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

  const admin = createAdminClient()

  // Una sola lectura: fecha de fin de trial + preapproval previo
  const { data: susc } = await admin
    .from('suscripciones')
    .select('ciclo_fin, mp_preapproval_id')
    .eq('ferreteria_id', session.ferreteriaId)
    .maybeSingle()

  // Si está en trial vigente, el primer cobro se programa para el fin de la
  // prueba: paga hoy pero conserva sus días gratis (días restantes + 30).
  let primerCobro: string | null = null
  if (session.estadoSuscripcion === 'trial' && susc?.ciclo_fin && susc.ciclo_fin > hoyLima()) {
    primerCobro = susc.ciclo_fin
  }

  // Nunca dejar dos suscripciones vivas: si ya hay una autorizada se corta
  // aquí, y si quedó una a medias se cancela antes de crear la nueva.
  const previo = await limpiarPreapprovalPrevio(susc?.mp_preapproval_id ?? null)
  if (previo.yaActiva) {
    // Se pasa el objeto ya consultado — evita pedirlo a MP otra vez
    await sincronizarPreapproval(previo.preapprovalActivo!)
    return NextResponse.json(
      {
        yaActiva: true,
        preapprovalId: previo.preapprovalActivo!.id,
        error: 'Tu suscripción ya está activa. Si no ves el acceso, recarga la página.',
      },
      { status: 409 }
    )
  }

  try {
    const { preapprovalId, initPoint, status, preapproval } = await crearSuscripcionMP({
      ferreteriaId: session.ferreteriaId,
      payerEmail:   email,
      baseUrl,
      primerCobro,
      cardTokenId,
    })

    // Guardar el intento en la suscripción (si existe fila) para reconciliar.
    await admin
      .from('suscripciones')
      .update({
        mp_preapproval_id: preapprovalId,
        mp_payer_email:    email,
        updated_at:        new Date().toISOString(),
      })
      .eq('ferreteria_id', session.ferreteriaId)

    // Flujo embebido (tarjeta en la página): el preapproval ya existe.
    // Se devuelve el estado REAL — 'pending' no es un rechazo: MP todavía
    // está validando y puede autorizar en minutos. Tratarlo como error hacía
    // que el cliente pagara otra vez y terminara con doble cobro.
    if (cardTokenId) {
      if (status === 'authorized') {
        // Activar de una para que entre sin esperar al webhook. Se pasa el
        // objeto que MP acaba de devolver: una consulta menos de espera.
        await sincronizarPreapproval(preapproval)
      }
      return NextResponse.json({ preapprovalId, status })
    }

    // Flujo con redirección al checkout de MP (requiere cuenta de MP)
    return NextResponse.json({ url: initPoint })
  } catch (err) {
    console.error('[suscripcion/checkout]', err)
    const msg = err instanceof Error ? err.message : ''
    // MP rechaza el checkout si el email pertenece a la misma cuenta que cobra
    if (msg.includes('payer') && msg.includes('collector')) {
      return NextResponse.json(
        { error: 'Ese correo pertenece a la cuenta que cobra. Usa otro correo.' },
        { status: 400 }
      )
    }
    if (cardTokenId) {
      return NextResponse.json(
        { error: 'Tu tarjeta fue rechazada. Verifica los datos, que tenga saldo, o intenta con otra tarjeta.' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'No pudimos iniciar el pago. Inténtalo de nuevo o escríbenos por WhatsApp.' },
      { status: 502 }
    )
  }
}
