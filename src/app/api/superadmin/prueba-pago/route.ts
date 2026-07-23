/**
 * POST /api/superadmin/prueba-pago
 *
 * Banco de pruebas de pago del superadmin. Cobra un pago ÚNICO y real de S/2
 * con la misma tokenización de tarjeta que el checkout de suscripciones, solo
 * para verificar que una tarjeta pasa y qué tipo es (crédito/débito).
 *
 * NO crea suscripción, NO activa/suspende cuentas, NO toca ningún acceso ni
 * el estado de ningún negocio. Es un cobro aislado que devuelve el resultado.
 *
 * Acceso restringido a superadmin (requireSuperadminAdmin).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import {
  crearPagoUnicoMP,
  suscripcionesMPConfigurado,
  mensajeErrorMP,
  MPError,
} from '@/lib/suscripciones/mercadopago'

export const dynamic = 'force-dynamic'

const MONTO_PRUEBA = 2 // S/ 2

export async function POST(request: NextRequest) {
  const session = await requireSuperadminAdmin(request)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado — solo superadmin' }, { status: 403 })
  }

  if (!suscripcionesMPConfigurado()) {
    return NextResponse.json(
      { error: 'Mercado Pago no está configurado en el servidor (falta MP_ACCESS_TOKEN).' },
      { status: 503 }
    )
  }

  let cardTokenId = ''
  let paymentMethodId: string | undefined
  let email = ''
  try {
    const body = await request.json()
    cardTokenId = String(body?.cardTokenId ?? '')
    paymentMethodId = body?.paymentMethodId ? String(body.paymentMethodId) : undefined
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    // se valida abajo
  }

  if (!cardTokenId) {
    return NextResponse.json({ error: 'Faltan los datos de la tarjeta.' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ingresa un correo válido.' }, { status: 400 })
  }

  try {
    const pago = await crearPagoUnicoMP({
      cardTokenId,
      payerEmail:      email,
      paymentMethodId,
      montoSoles:      MONTO_PRUEBA,
      descripcion:     'Prueba de pago — Uintegrus',
    })

    const tipoLegible = pago.payment_type_id === 'credit_card'
      ? 'Tarjeta de crédito'
      : pago.payment_type_id === 'debit_card'
        ? 'Tarjeta de débito'
        : pago.payment_type_id

    return NextResponse.json({
      ok:            pago.status === 'approved',
      status:        pago.status,          // approved | rejected | in_process | pending
      statusDetail:  pago.status_detail,
      tipo:          tipoLegible,          // crédito / débito
      medio:         pago.payment_method_id, // visa / master / ...
      monto:         pago.transaction_amount,
      // Mensaje amable si no fue aprobado (mismo mapeo que el checkout real)
      mensaje: pago.status === 'approved'
        ? '¡Pago aprobado! La tarjeta funciona correctamente.'
        : mensajeErrorMP(new MPError(`${pago.status}: ${pago.status_detail}`, 400, pago.status_detail)),
    })
  } catch (err) {
    console.error('[superadmin/prueba-pago]', err)
    return NextResponse.json({ error: mensajeErrorMP(err) }, { status: 400 })
  }
}
