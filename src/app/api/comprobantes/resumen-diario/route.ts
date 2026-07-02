import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { desencriptar } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 60_000

async function llamarGreenter(greenterUrl: string, endpoint: string, payload: object) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${greenterUrl.replace(/\/$/, '')}/${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    })
    clearTimeout(timer)
    const texto = await res.text().catch(() => '')
    try { return JSON.parse(texto) } catch { return { ok: false, error: 'Respuesta no-JSON del servicio Greenter' } }
  } catch (e) {
    clearTimeout(timer)
    return { ok: false, error: e instanceof Error && e.name === 'AbortError' ? 'Timeout >60s' : String(e) }
  }
}

// ── GET: listar RCs enviados + boletas pendientes del día ──────────────────────
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

  const supabase = await createClient()

  const [{ data: rcs }, { data: boletas }] = await Promise.all([
    supabase
      .from('sunat_resumenes_diarios')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('fecha', fecha)
      .order('correlativo', { ascending: false }),

    supabase
      .from('comprobantes')
      .select('id, numero_completo, serie, numero, total, igv, subtotal, estado, tipo, created_at')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('tipo', 'boleta')
      .eq('estado', 'emitido')
      .gte('created_at', `${fecha}T00:00:00-05:00`)
      .lt('created_at',  `${fecha}T24:00:00-05:00`)
      .order('numero', { ascending: true }),
  ])

  return NextResponse.json({
    fecha,
    resumenes:         rcs ?? [],
    boletas_del_dia:   boletas ?? [],
    boletas_count:     boletas?.length ?? 0,
    boletas_total:     boletas?.reduce((acc, b) => acc + (b.total ?? 0), 0) ?? 0,
  })
}

// ── POST: enviar Resumen Diario de Boletas a SUNAT ────────────────────────────
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json() as { fecha?: string }
  const fecha = body.fecha ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

  const supabase = await createClient()

  // 1. Cargar credenciales SUNAT activas
  const { data: creds } = await supabase
    .from('sunat_credenciales')
    .select('ruc, razon_social, sol_usuario_enc, sol_clave_enc, cert_pfx_enc, cert_clave_enc, greenter_url, modo')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('estado', 'activo')
    .single()

  if (!creds) {
    return NextResponse.json({ error: 'SUNAT Directo no configurado o inactivo. Actívalo en Configuración → Integraciones → SUNAT Directo.' }, { status: 400 })
  }

  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('ruc, razon_social, direccion')
    .eq('id', session.ferreteriaId)
    .single()

  // 2. Cargar boletas del día
  const { data: boletas } = await supabase
    .from('comprobantes')
    .select('id, numero_completo, serie, numero, total, igv, subtotal')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'boleta')
    .eq('estado', 'emitido')
    .gte('created_at', `${fecha}T00:00:00-05:00`)
    .lt('created_at',  `${fecha}T24:00:00-05:00`)
    .order('numero', { ascending: true })

  if (!boletas || boletas.length === 0) {
    return NextResponse.json({ error: `No hay boletas emitidas el ${fecha} para incluir en el Resumen Diario.` }, { status: 400 })
  }

  // 3. Calcular correlativo (cuántos RCs ya enviamos hoy + 1)
  const { count: rcHoy } = await supabase
    .from('sunat_resumenes_diarios')
    .select('id', { count: 'exact', head: true })
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('fecha', fecha)

  const correlativo = (rcHoy ?? 0) + 1

  // 4. Descifrar credenciales
  let solUsuario: string, solClave: string, certPfxB64: string, certClave: string
  try {
    [solUsuario, solClave, certPfxB64, certClave] = await Promise.all([
      desencriptar(creds.sol_usuario_enc),
      desencriptar(creds.sol_clave_enc),
      desencriptar(creds.cert_pfx_enc),
      desencriptar(creds.cert_clave_enc),
    ])
  } catch {
    return NextResponse.json({ error: 'Error al descifrar las credenciales SUNAT' }, { status: 500 })
  }

  // 5. Llamar a Greenter
  const respuesta = await llamarGreenter(creds.greenter_url, 'resumen-diario/emitir', {
    modo:        creds.modo,
    fecha,
    correlativo,
    emisor: {
      ruc:          creds.ruc,
      razon_social: creds.razon_social,
      direccion:    ferreteria?.direccion ?? '-',
    },
    sol:         { usuario: solUsuario, clave: solClave },
    certificado: { pfx_base64: certPfxB64, clave: certClave },
    boletas: boletas.map(b => ({
      serie:    b.serie,
      numero:   b.numero,
      subtotal: b.subtotal ?? 0,
      igv:      b.igv ?? 0,
      total:    b.total ?? 0,
    })),
  })

  if (!respuesta.ok) {
    return NextResponse.json({ error: respuesta.error ?? 'Error en Greenter al enviar el Resumen Diario' }, { status: 400 })
  }

  // 6. Guardar el RC en BD
  const boletasTotal = boletas.reduce((acc, b) => acc + (b.total ?? 0), 0)
  const { data: rc, error: rcError } = await supabase
    .from('sunat_resumenes_diarios')
    .insert({
      ferreteria_id:  session.ferreteriaId,
      fecha,
      correlativo,
      ticket:         respuesta.ticket ?? null,
      estado:         'enviado',
      boletas_count:  boletas.length,
      boletas_total:  boletasTotal,
    })
    .select('id, ticket, correlativo')
    .single()

  if (rcError) {
    return NextResponse.json({ error: 'RC enviado a SUNAT pero error al guardarlo: ' + rcError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok:          true,
    ticket:      respuesta.ticket,
    correlativo,
    rc_id:       rc?.id,
    fecha,
    boletas_count: boletas.length,
    boletas_total: boletasTotal,
  })
}

// ── PATCH: consultar estado de un ticket RC ────────────────────────────────────
export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json() as { rc_id: string }
  if (!body.rc_id) return NextResponse.json({ error: 'rc_id requerido' }, { status: 400 })

  const supabase = await createClient()

  const { data: rc } = await supabase
    .from('sunat_resumenes_diarios')
    .select('id, ticket, estado')
    .eq('id', body.rc_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!rc) return NextResponse.json({ error: 'RC no encontrado' }, { status: 404 })
  if (!rc.ticket) return NextResponse.json({ error: 'Este RC no tiene ticket SUNAT para consultar' }, { status: 400 })

  const { data: creds } = await supabase
    .from('sunat_credenciales')
    .select('sol_usuario_enc, sol_clave_enc, cert_pfx_enc, cert_clave_enc, greenter_url, modo')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!creds) return NextResponse.json({ error: 'Credenciales SUNAT no encontradas' }, { status: 400 })

  let solUsuario: string, solClave: string, certPfxB64: string, certClave: string
  try {
    [solUsuario, solClave, certPfxB64, certClave] = await Promise.all([
      desencriptar(creds.sol_usuario_enc),
      desencriptar(creds.sol_clave_enc),
      desencriptar(creds.cert_pfx_enc),
      desencriptar(creds.cert_clave_enc),
    ])
  } catch {
    return NextResponse.json({ error: 'Error al descifrar credenciales' }, { status: 500 })
  }

  const respuesta = await llamarGreenter(creds.greenter_url, 'resumen-diario/consultar', {
    modo:        creds.modo,
    ticket:      rc.ticket,
    sol:         { usuario: solUsuario, clave: solClave },
    certificado: { pfx_base64: certPfxB64, clave: certClave },
  })

  if (!respuesta.ok) {
    return NextResponse.json({ error: respuesta.error }, { status: 400 })
  }

  const nuevoEstado = respuesta.cdr_codigo === '0' ? 'aceptado'
    : respuesta.cdr_codigo === '2' ? 'aceptado'
    : 'rechazado'

  await supabase
    .from('sunat_resumenes_diarios')
    .update({
      estado:          nuevoEstado,
      cdr_codigo:      respuesta.cdr_codigo,
      cdr_descripcion: respuesta.cdr_descripcion,
      consultado_at:   new Date().toISOString(),
    })
    .eq('id', body.rc_id)

  return NextResponse.json({
    ok:              true,
    estado:          nuevoEstado,
    cdr_codigo:      respuesta.cdr_codigo,
    cdr_descripcion: respuesta.cdr_descripcion,
  })
}
