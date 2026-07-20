/**
 * POST /api/webhook/mercadopago — notificaciones de suscripciones SaaS.
 *
 * Ruta pública (el prefijo /api/webhook está en RUTAS_PUBLICAS del proxy).
 *
 * Seguridad: el payload NUNCA se usa como fuente de verdad — solo se toma el
 * data.id y se consulta el estado real a la API de MP con nuestro token, así
 * una notificación forjada no puede activar cuentas. Si MP_WEBHOOK_SECRET
 * está configurado, además se valida la firma x-signature.
 *
 * Topics manejados:
 *  - subscription_preapproval          → alta/cancelación de la suscripción
 *  - subscription_authorized_payment   → cobro mensual (historial pagos_saas)
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import {
  sincronizarPreapproval,
  registrarCobroAutorizado,
} from '@/lib/suscripciones/mercadopago'

export const dynamic = 'force-dynamic'

/** Valida la firma x-signature de MP: HMAC-SHA256 de `id:<dataId>;request-id:<xRequestId>;ts:<ts>;` */
function firmaValida(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true // sin secret configurado, la seguridad recae en re-consultar a MP

  const xSignature = request.headers.get('x-signature') ?? ''
  const xRequestId = request.headers.get('x-request-id') ?? ''

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=') as [string, string])
  )
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  // MP exige el id en minúsculas cuando es alfanumérico
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`
  const esperado = createHmac('sha256', secret).update(manifest).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(esperado), Buffer.from(v1))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  let body: { type?: string; topic?: string; action?: string; data?: { id?: string } } = {}
  try {
    body = await request.json()
  } catch {
    // MP también notifica solo con query params
  }

  const topic =
    body?.type ?? body?.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
  const dataId =
    body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? ''

  if (!dataId) return NextResponse.json({ ok: true, skip: 'sin data.id' })

  if (!firmaValida(request, String(dataId))) {
    console.warn('[webhook/mercadopago] firma inválida', { topic, dataId })
    return NextResponse.json({ error: 'firma inválida' }, { status: 401 })
  }

  try {
    if (topic === 'subscription_preapproval') {
      const res = await sincronizarPreapproval(String(dataId))
      console.log('[webhook/mercadopago] preapproval sync', { dataId, ...res })
    } else if (topic === 'subscription_authorized_payment') {
      await registrarCobroAutorizado(String(dataId))
      console.log('[webhook/mercadopago] cobro registrado', { dataId })
    }
    // Otros topics (payment, plan, etc.) se aceptan sin acción.
  } catch (err) {
    // 200 igualmente: si respondemos 5xx MP reintenta en ráfaga; el estado
    // se reconcilia en la siguiente notificación o al volver del checkout.
    console.error('[webhook/mercadopago]', topic, dataId, err)
  }

  return NextResponse.json({ ok: true })
}

// Healthcheck / verificación manual desde el panel de MP
export async function GET() {
  return NextResponse.json({ ok: true, servicio: 'webhook mercadopago suscripciones' })
}
