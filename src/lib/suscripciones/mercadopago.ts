/**
 * Suscripciones SaaS con Mercado Pago (Preapproval).
 *
 * Uintegrus cobra S/ 80/mes a cada negocio usando la cuenta MP propia
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
  precio:  80,
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

/** Timeout por intento — MP suele responder en < 2s; 15s ya es anomalía. */
const MP_TIMEOUT_MS = 15_000
/** Reintentos ante fallas transitorias (red o 5xx de MP). */
const MP_MAX_INTENTOS = 3

export interface MPOpciones {
  timeoutMs?: number
  maxIntentos?: number
}

/**
 * Perfil acotado para el webhook: MP corta la conexión a los ~22s y reintenta
 * la notificación. Con 2 intentos de 6s el peor caso queda en ~12s, dentro de
 * ese margen. (Y si aun así falla, MP reenvía y el proceso es idempotente.)
 */
export const PERFIL_WEBHOOK: MPOpciones = { timeoutMs: 6_000, maxIntentos: 2 }

/** Error con el status HTTP de MP, para decidir si reintentar y qué mostrar. */
export class MPError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly body: string = '',
  ) {
    super(message)
    this.name = 'MPError'
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Traduce el rechazo de MP a algo que el cliente pueda accionar.
 *
 * MP devuelve códigos precisos (`cc_rejected_*`) y mostrarle a todos
 * "revisa tu tarjeta" hace que culpen a su banco cuando el problema puede
 * ser un CVV mal tipeado. Cada mensaje dice QUÉ corregir.
 */
export function mensajeErrorMP(err: unknown): string {
  const generico = 'No pudimos procesar el pago. Inténtalo de nuevo o escríbenos por WhatsApp.'
  if (!(err instanceof MPError)) return generico

  const texto = `${err.message} ${err.body}`.toLowerCase()

  // El correo del pagador no puede ser el de la cuenta que cobra
  if (
    (texto.includes('payer') && texto.includes('collector')) ||
    texto.includes('cannot_be_the_same') ||
    texto.includes('same user')
  ) {
    return 'Ese correo pertenece a la cuenta que cobra. Usa el correo de tu cuenta personal.'
  }

  const porCodigo: Array<[string, string]> = [
    ['cc_rejected_bad_filled_card_number', 'El número de tarjeta es incorrecto. Revísalo e intenta de nuevo.'],
    ['cc_rejected_bad_filled_security_code', 'El código de seguridad (CVV) es incorrecto.'],
    ['cc_rejected_bad_filled_date',         'La fecha de vencimiento es incorrecta.'],
    ['cc_rejected_bad_filled_other',        'Hay un dato incorrecto en la tarjeta. Revisa todos los campos.'],
    ['cc_rejected_insufficient_amount',     'Tu tarjeta no tiene fondos suficientes. Intenta con otra.'],
    // Neutro a propósito: "rechazo por seguridad" asusta al cliente. Se le
    // ofrece continuar en Mercado Pago, donde esta validacion suele pasar.
    ['cc_rejected_high_risk',               'No pudimos completar el pago con esta tarjeta.'],
    ['cc_rejected_max_attempts',            'Demasiados intentos con esta tarjeta. Espera un momento o usa otra.'],
    ['cc_rejected_call_for_authorize',      'Tu banco necesita que autorices este pago. Llámalos y vuelve a intentar.'],
    ['cc_rejected_card_disabled',           'Tu tarjeta está inhabilitada para compras por internet. Actívala con tu banco.'],
    ['cc_rejected_duplicated_payment',      'Ya registramos un pago igual hace un momento. Revisa tu suscripción antes de reintentar.'],
    ['cc_rejected_card_error',              'Hubo un problema con la tarjeta. Intenta de nuevo o usa otra.'],
    ['cc_rejected_invalid_installments',    'Esa tarjeta no admite esta modalidad de pago. Usa otra.'],
    ['cc_rejected_blacklist',               'No pudimos completar el pago con esta tarjeta.'],
    ['invalid card_token_id',               'Los datos de la tarjeta expiraron. Vuelve a ingresarlos.'],
    ['invalid_card_token',                  'Los datos de la tarjeta expiraron. Vuelve a ingresarlos.'],
  ]

  for (const [codigo, mensaje] of porCodigo) {
    if (texto.includes(codigo)) return mensaje
  }

  // Sin conexión con MP tras los reintentos
  if (err.status === null) {
    return 'No pudimos conectar con Mercado Pago. Revisa tu internet e inténtalo en unos segundos.'
  }
  if (err.status >= 500) {
    return 'Mercado Pago está presentando problemas en este momento. Inténtalo en unos minutos.'
  }
  if (err.status === 401 || err.status === 403) {
    return 'El cobro en línea no está disponible por el momento. Escríbenos por WhatsApp.'
  }

  return generico
}

/**
 * Llama a la API de MP con timeout y reintentos.
 *
 * Solo reintenta lo que es seguro reintentar: fallas de red, timeouts y 5xx
 * (MP no llegó a procesar, o falló de su lado). Un 4xx es una respuesta
 * definitiva — reintentarlo solo haría esperar de más al cliente.
 *
 * Los POST que crean suscripciones viajan con `idempotencyKey`, así que un
 * reintento nunca genera un segundo cobro.
 */
async function mpFetch(
  path: string,
  init?: RequestInit & { idempotencyKey?: string } & MPOpciones,
) {
  const { idempotencyKey, timeoutMs, maxIntentos, ...rest } = init ?? {}
  const metodo = init?.method ?? 'GET'
  const limiteIntentos = maxIntentos ?? MP_MAX_INTENTOS
  const limiteTiempo = timeoutMs ?? MP_TIMEOUT_MS
  let ultimoError: unknown

  for (let intento = 1; intento <= limiteIntentos; intento++) {
    try {
      const res = await fetch(`${MP_API}${path}`, {
        ...rest,
        signal: AbortSignal.timeout(limiteTiempo),
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'Content-Type': 'application/json',
          // MP deduplica por esta clave: dos envíos idénticos (doble clic,
          // reintento de red, dos pestañas) devuelven el MISMO preapproval en
          // lugar de crear una segunda suscripción que cobraría aparte.
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
          ...init?.headers,
        },
      })

      if (res.ok) return res.json()

      const body = await res.text()
      const error = new MPError(`MP ${metodo} ${path} → ${res.status}: ${body}`, res.status, body)

      // 4xx = respuesta definitiva de MP; no tiene sentido insistir
      if (res.status < 500) throw error

      ultimoError = error
    } catch (err) {
      // Un 4xx ya viene decidido: propagar sin reintentar
      if (err instanceof MPError && err.status !== null && err.status < 500) throw err
      ultimoError = err
    }

    if (intento < limiteIntentos) {
      await esperar(300 * 2 ** (intento - 1)) // 300ms, 600ms
    }
  }

  const detalle = ultimoError instanceof Error ? ultimoError.message : String(ultimoError)
  throw ultimoError instanceof MPError
    ? ultimoError
    : new MPError(`MP ${metodo} ${path} sin respuesta tras ${limiteIntentos} intentos: ${detalle}`, null)
}

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface MPPreapproval {
  id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled'
  external_reference: string          // ferreteriaId
  payer_email?: string
  next_payment_date?: string
  date_created?: string
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

// ─── Pago único de prueba (solo superadmin) ────────────────────────────────

export interface MPPagoUnico {
  id: number
  status: string            // approved | rejected | in_process | pending
  status_detail: string     // accredited | cc_rejected_* | ...
  payment_type_id: string   // credit_card | debit_card | ...
  payment_method_id: string // visa | master | ...
  transaction_amount: number
}

/**
 * Crea un pago ÚNICO (no recurrente) vía /v1/payments. Se usa SOLO en el
 * banco de pruebas del superadmin: cobra un monto chico real para verificar
 * que una tarjeta pasa y qué tipo es (crédito/débito). No crea suscripción,
 * no toca accesos ni el estado de ningún negocio.
 */
export async function crearPagoUnicoMP(params: {
  cardTokenId: string
  payerEmail: string
  paymentMethodId?: string
  montoSoles: number
  descripcion: string
}): Promise<MPPagoUnico> {
  const body: Record<string, unknown> = {
    transaction_amount: params.montoSoles,
    token:              params.cardTokenId,
    description:        params.descripcion,
    installments:       1,
    payer:             { email: params.payerEmail },
  }
  if (params.paymentMethodId) body.payment_method_id = params.paymentMethodId

  return mpFetch('/v1/payments', {
    method: 'POST',
    body: JSON.stringify(body),
    // Un token de tarjeta es de un solo uso; sirve de clave estable para que
    // un reintento no duplique el cobro.
    idempotencyKey: `prueba-${params.cardTokenId}`,
  })
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
}): Promise<{
  preapprovalId: string
  initPoint: string | null
  status: string
  preapproval: MPPreapproval
}> {
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

  // Clave estable por intento: con tarjeta, el token la identifica; sin
  // tarjeta, el tenant + correo dentro de una ventana de un minuto.
  const idempotencyKey = params.cardTokenId
    ? `sub-${params.ferreteriaId}-${params.cardTokenId}`
    : `sub-${params.ferreteriaId}-${params.payerEmail}-${Math.floor(Date.now() / 60_000)}`

  const data: MPPreapproval = await mpFetch('/preapproval', {
    method: 'POST',
    body: JSON.stringify(body),
    idempotencyKey,
  })

  if (!params.cardTokenId && !data.init_point) {
    throw new Error('MP no devolvió init_point')
  }
  return {
    preapprovalId: data.id,
    initPoint:     data.init_point ?? null,
    status:        data.status,
    preapproval:   data,
  }
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

/**
 * Garantiza que un tenant nunca acumule dos suscripciones cobrando a la vez.
 *
 * Antes de crear un preapproval nuevo se revisa el anterior (si lo hay):
 *  - `authorized` → ya está pagando; NO se crea otro (devuelve yaActiva).
 *  - `pending`    → intento anterior que quedó a medias; se cancela para que
 *                   no pueda activarse después y terminar cobrando doble.
 *  - resto        → no estorba, se sigue de largo.
 *
 * Si la consulta a MP falla no se bloquea al usuario: se deja seguir y se
 * registra el aviso (mejor un posible duplicado raro que un cliente que no
 * puede pagar).
 */
export async function limpiarPreapprovalPrevio(preapprovalIdPrevio: string | null): Promise<{
  yaActiva: boolean
  preapprovalActivo?: MPPreapproval
}> {
  if (!preapprovalIdPrevio) return { yaActiva: false }

  try {
    const pre = await obtenerPreapproval(preapprovalIdPrevio)

    if (pre.status === 'authorized') {
      return { yaActiva: true, preapprovalActivo: pre }
    }

    if (pre.status === 'pending') {
      await cancelarPreapproval(pre.id)
      console.log('[MP] preapproval pendiente previo cancelado', { id: pre.id })
    }

    return { yaActiva: false }
  } catch (err) {
    console.warn('[MP] no se pudo revisar el preapproval previo:', err)
    return { yaActiva: false }
  }
}

export async function obtenerPreapproval(id: string, opts?: MPOpciones): Promise<MPPreapproval> {
  return mpFetch(`/preapproval/${id}`, opts)
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
 * Actualiza la BD según el estado REAL del preapproval en MP.
 * Nunca confía en el payload del webhook — solo en lo que responde MP.
 *
 * Acepta el id (lo consulta) o un preapproval ya obtenido por el llamador,
 * para no repetir la misma consulta dos veces en un mismo flujo.
 */
export async function sincronizarPreapproval(
  preapproval: string | MPPreapproval,
  opts?: MPOpciones,
): Promise<{
  status: MPPreapproval['status']
  ferreteriaId: string | null
}> {
  const pre = typeof preapproval === 'string'
    ? await obtenerPreapproval(preapproval, opts)
    : preapproval
  const ferreteriaId = pre.external_reference || null
  if (!ferreteriaId) return { status: pre.status, ferreteriaId: null }

  if (pre.status === 'authorized') {
    // El monto autorizado debe coincidir con el plan. Si no coincide se avisa
    // pero no se bloquea el acceso: el cliente ya autorizó y dejarlo afuera
    // por una diferencia de precio (ej. tras un cambio de tarifa) sería peor.
    const monto = pre.auto_recurring?.transaction_amount
    if (monto != null && Math.abs(monto - PLAN_SAAS.precio) > 0.01) {
      console.warn('[MP] monto distinto al plan', {
        preapproval: pre.id,
        ferreteriaId,
        montoAutorizado: monto,
        montoEsperado: PLAN_SAAS.precio,
      })
    }

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
export async function registrarCobroAutorizado(
  authorizedPaymentId: string,
  opts?: MPOpciones,
): Promise<void> {
  const pago: MPAuthorizedPayment = await mpFetch(`/authorized_payments/${authorizedPaymentId}`, opts)
  if (!pago?.preapproval_id) return

  const pre = await obtenerPreapproval(pago.preapproval_id, opts)
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

  // El estado de acceso (activo/suspendido) lo dicta el preapproval — se
  // reutiliza el ya consultado arriba en vez de volver a pedirlo a MP.
  await sincronizarPreapproval(pre, opts)
}
