/**
 * Suscripciones SaaS con Mercado Pago (Preapproval).
 *
 * Uintegrus cobra S/ 85/mes a cada negocio usando la cuenta MP propia
 * (MP_ACCESS_TOKEN). No confundir con src/lib/mercadopago.ts, que es el
 * OAuth por tenant para que cada negocio cobre a SUS clientes (futuro).
 *
 * Flujo:
 *  1. POST /api/suscripcion/checkout crea un preapproval "pending" y
 *     redirige al init_point (checkout seguro de MP).
 *  2. MP notifica a /api/webhook/mercadopago → sincronizarPreapproval()
 *     actualiza suscripciones.estado ('activo' | 'suspendido') — el mismo
 *     campo que gestiona el superadmin.
 *  3. back_url = /suscripcion/gracias verifica el estado al volver.
 *
 * Env vars:
 *   MP_ACCESS_TOKEN     — Access Token de producción de la cuenta Uintegrus
 *   MP_WEBHOOK_SECRET   — (opcional) clave secreta del webhook en el panel MP
 *   NEXT_PUBLIC_APP_URL — base para el back_url
 */

import { createAdminClient } from '@/lib/supabase/admin'

const MP_API = 'https://api.mercadopago.com'

export const PLAN_SAAS = {
  nombre:  'Todo Incluido',
  precio:  85,
  moneda:  'PEN',
  razon:   'Uintegrus — Plan Todo Incluido',
} as const

// ─── Config ────────────────────────────────────────────────────────────────

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) throw new Error('MP_ACCESS_TOKEN no configurado')
  return token
}

/** Verifica si el cobro de suscripciones está configurado en el servidor. */
export function suscripcionesMPConfigurado(): boolean {
  return !!process.env.MP_ACCESS_TOKEN
}

async function mpFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`MP ${init?.method ?? 'GET'} ${path} → ${res.status}: ${body}`)
  }
  return res.json()
}

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface MPPreapproval {
  id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled'
  external_reference: string          // ferreteriaId
  payer_email?: string
  next_payment_date?: string
  init_point?: string
  auto_recurring?: { transaction_amount: number; currency_id: string }
}

interface MPAuthorizedPayment {
  id: number | string
  preapproval_id: string
  status: string                       // scheduled | processed | recycling...
  transaction_amount: number
  currency_id: string
  debit_date?: string
  payment?: { id: number; status: string; status_detail?: string }
}

// ─── Crear suscripción (checkout) ──────────────────────────────────────────

/** Fecha actual en Lima como YYYY-MM-DD. */
export function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

/**
 * Crea el preapproval en MP.
 *
 * Dos modos:
 *  - Sin `cardTokenId`: status 'pending' → devuelve init_point (checkout en
 *    la web de MP, requiere cuenta de Mercado Pago del pagador).
 *  - Con `cardTokenId` (tarjeta tokenizada en el navegador con la Public
 *    Key): status 'authorized' → el cobro queda autorizado SIN redirección.
 *
 * `primerCobro` (YYYY-MM-DD, opcional): fecha del primer cargo. Se usa cuando
 * el tenant paga durante el trial — la tarjeta se autoriza hoy pero el primer
 * cobro sale al terminar la prueba, así no pierde los días que le quedan.
 */
export async function crearSuscripcionMP(params: {
  ferreteriaId: string
  payerEmail: string
  baseUrl: string
  primerCobro?: string | null
  cardTokenId?: string | null
}): Promise<{ preapprovalId: string; initPoint: string | null; status: string }> {
  const autoRecurring: Record<string, unknown> = {
    frequency:          1,
    frequency_type:     'months',
    transaction_amount: PLAN_SAAS.precio,
    currency_id:        PLAN_SAAS.moneda,
  }
  // start_date solo si es una fecha futura (MP rechaza fechas pasadas)
  if (params.primerCobro && params.primerCobro > hoyLima()) {
    autoRecurring.start_date = `${params.primerCobro}T12:00:00.000-05:00`
  }

  const body: Record<string, unknown> = {
    reason:             PLAN_SAAS.razon,
    external_reference: params.ferreteriaId,
    payer_email:        params.payerEmail,
    auto_recurring:     autoRecurring,
    back_url:           `${params.baseUrl}/suscripcion/gracias`,
  }

  if (params.cardTokenId) {
    body.card_token_id = params.cardTokenId
    body.status        = 'authorized'
  } else {
    body.status = 'pending'
  }

  const data: MPPreapproval = await mpFetch('/preapproval', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!params.cardTokenId && !data.init_point) {
    throw new Error('MP no devolvió init_point')
  }
  return { preapprovalId: data.id, initPoint: data.init_point ?? null, status: data.status }
}

/**
 * Cancela la suscripción en MP. El webhook (o el sync inmediato del caller)
 * se encarga de reflejar el estado en la BD.
 */
export async function cancelarPreapproval(preapprovalId: string): Promise<void> {
  await mpFetch(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  })
}

export async function obtenerPreapproval(id: string): Promise<MPPreapproval> {
  return mpFetch(`/preapproval/${id}`)
}

// ─── Sincronización con la BD ──────────────────────────────────────────────

async function getPlanTodoIncluidoId(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from('planes')
    .select('id')
    .eq('nombre', PLAN_SAAS.nombre)
    .single()
  return data?.id ?? null
}

/**
 * Aplica un cambio de estado a la suscripción del tenant (update, y si no
 * existe fila, insert) — mismo patrón que usa el superadmin.
 */
async function upsertSuscripcion(
  ferreteriaId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('suscripciones')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('ferreteria_id', ferreteriaId)
    .select('id')

  if (error) throw new Error(`Error actualizando suscripción: ${error.message}`)
  if (data && data.length > 0) return

  const planId = await getPlanTodoIncluidoId(admin)
  const { error: insertError } = await admin.from('suscripciones').insert({
    ferreteria_id:        ferreteriaId,
    plan_id:              planId,
    creditos_del_mes:     999999,
    creditos_disponibles: 999999,
    creditos_extra:       0,
    estado:               'suspendido',
    ...fields,
  })
  if (insertError) throw new Error(`Error creando suscripción: ${insertError.message}`)
}

/**
 * Lee el preapproval REAL desde la API de MP y actualiza la BD.
 * Nunca confía en el payload del webhook — solo en lo que responde MP.
 * Devuelve el estado resultante para la UI.
 */
export async function sincronizarPreapproval(preapprovalId: string): Promise<{
  status: MPPreapproval['status']
  ferreteriaId: string | null
}> {
  const pre = await obtenerPreapproval(preapprovalId)
  const ferreteriaId = pre.external_reference || null
  if (!ferreteriaId) return { status: pre.status, ferreteriaId: null }

  if (pre.status === 'authorized') {
    const proximoCobro = pre.next_payment_date?.slice(0, 10) ?? null
    await upsertSuscripcion(ferreteriaId, {
      estado:            'activo',
      ciclo_inicio:      new Date().toISOString().slice(0, 10),
      ciclo_fin:         proximoCobro,
      proximo_cobro:     proximoCobro,
      mp_preapproval_id: pre.id,
      mp_payer_email:    pre.payer_email ?? null,
    })
  } else if (pre.status === 'cancelled' || pre.status === 'paused') {
    // Solo suspender si ESTE preapproval es el que activó la cuenta
    // (evita que un intento viejo cancelado pise una suscripción vigente).
    const admin = createAdminClient()
    const { data } = await admin
      .from('suscripciones')
      .select('mp_preapproval_id')
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()

    if (data?.mp_preapproval_id === pre.id) {
      await upsertSuscripcion(ferreteriaId, { estado: 'suspendido' })
    }
  }
  // 'pending' → el usuario aún no completó el pago: no tocar el estado.

  return { status: pre.status, ferreteriaId }
}

/**
 * Registra un cobro mensual (topic subscription_authorized_payment) en
 * pagos_saas y refresca proximo_cobro. Idempotente por mp_payment_id.
 */
export async function registrarCobroAutorizado(authorizedPaymentId: string): Promise<void> {
  const pago: MPAuthorizedPayment = await mpFetch(`/authorized_payments/${authorizedPaymentId}`)
  if (!pago?.preapproval_id) return

  const pre = await obtenerPreapproval(pago.preapproval_id)
  const ferreteriaId = pre.external_reference || null
  if (!ferreteriaId) return

  const admin = createAdminClient()
  await admin.from('pagos_saas').upsert(
    {
      ferreteria_id:     ferreteriaId,
      mp_payment_id:     String(pago.payment?.id ?? pago.id),
      mp_preapproval_id: pago.preapproval_id,
      monto:             pago.transaction_amount,
      moneda:            pago.currency_id ?? 'PEN',
      estado:            pago.payment?.status ?? pago.status,
      raw:               pago as unknown as Record<string, unknown>,
    },
    { onConflict: 'mp_payment_id', ignoreDuplicates: true }
  )

  // El estado de acceso (activo/suspendido) lo dicta el preapproval.
  await sincronizarPreapproval(pago.preapproval_id)
}
