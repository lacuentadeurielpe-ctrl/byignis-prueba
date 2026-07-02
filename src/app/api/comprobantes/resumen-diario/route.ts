import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { desencriptar } from '@/lib/encryption'
import { pfxAPem } from '@/lib/facturacion/lycet/cert'
import { mapearResumenDiario } from '@/lib/facturacion/lycet/mappers'
import { ensureCompany, enviarSummary, consultarSummary, type LycetConfig } from '@/lib/facturacion/lycet/client'

export const dynamic = 'force-dynamic'

function getLycetConfig(): LycetConfig {
  const baseUrl = process.env.LYCET_BASE_URL
  const token   = process.env.LYCET_API_TOKEN
  if (!baseUrl || !token) throw new Error('LYCET_BASE_URL / LYCET_API_TOKEN no configurados')
  return { baseUrl, token }
}

// ── GET: boletas pendientes del día + RCs enviados ────────────────────────────
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

    // Filtramos por fecha_emision (fiscal, Lima) en lugar de created_at (UTC del servidor).
    // Así el RC incluye exactamente las boletas del día fiscal, sin importar la zona horaria del servidor.
    supabase
      .from('comprobantes')
      .select('id, numero_completo, serie, numero, total, igv, subtotal, estado, estado_sunat, tipo, fecha_emision, rc_id')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('tipo', 'boleta')
      .eq('estado', 'emitido')
      .eq('fecha_emision', fecha)
      .order('numero', { ascending: true }),
  ])

  return NextResponse.json({
    fecha,
    resumenes:       rcs ?? [],
    boletas_del_dia: boletas ?? [],
    boletas_count:   boletas?.length ?? 0,
    boletas_total:   boletas?.reduce((acc, b) => acc + (b.total ?? 0), 0) ?? 0,
  })
}

// ── POST: enviar Resumen Diario a SUNAT vía Lycet ─────────────────────────────
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json() as { fecha?: string }
  const fecha = body.fecha ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

  const supabase = await createClient()

  // 1. Cargar credenciales activas
  const { data: creds } = await supabase
    .from('sunat_credenciales')
    .select('ruc, razon_social, sol_usuario_enc, sol_clave_enc, cert_pfx_enc, cert_clave_enc, cert_pem_enc, modo, direccion')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('estado', 'activo')
    .single()

  if (!creds) {
    return NextResponse.json(
      { error: 'SUNAT Directo no configurado o inactivo. Actívalo en Configuración → Integraciones → SUNAT Directo.' },
      { status: 400 },
    )
  }

  let lycetCfg: LycetConfig
  try { lycetCfg = getLycetConfig() }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 503 }) }

  // 2. Boletas del día por fecha_emision — excluir las ya declaradas (anti-duplicado)
  const { data: boletasRaw } = await supabase
    .from('comprobantes')
    .select('id, numero_completo, serie, numero, total, igv, subtotal, cliente_ruc_dni, sunat_cdr_codigo, rc_id')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'boleta')
    .eq('estado', 'emitido')
    .eq('fecha_emision', fecha)
    .order('numero', { ascending: true })

  const boletas = (boletasRaw ?? []).filter(
    b => b.rc_id == null && b.total != null && Number(b.total) > 0,
  )

  if (boletas.length === 0) {
    const totalRaw    = boletasRaw?.length ?? 0
    const yaDeclaradas = boletasRaw?.filter(b => b.rc_id != null).length ?? 0
    const msg = totalRaw === 0
      ? `No hay boletas emitidas el ${fecha} para incluir en el Resumen Diario.`
      : yaDeclaradas === totalRaw
        ? `Todas las boletas del ${fecha} ya fueron declaradas en un RC previo.`
        : `No hay boletas válidas (con importe > 0 y no declaradas) el ${fecha}.`
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // 3. Correlativo del RC (cuántos RCs hoy + 1)
  const { count: rcHoy } = await supabase
    .from('sunat_resumenes_diarios')
    .select('id', { count: 'exact', head: true })
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('fecha', fecha)

  const correlativo = (rcHoy ?? 0) + 1

  // 4. Desencriptar certificado → PEM
  let certPem: string
  try {
    if (creds.cert_pem_enc) {
      certPem = await desencriptar(creds.cert_pem_enc)
    } else {
      const [certPfxB64, certClave] = await Promise.all([
        desencriptar(creds.cert_pfx_enc),
        desencriptar(creds.cert_clave_enc),
      ])
      certPem = pfxAPem(certPfxB64, certClave).pem
    }
  } catch {
    return NextResponse.json({ error: 'Error al descifrar el certificado digital' }, { status: 500 })
  }

  const [solUsuario, solClave] = await Promise.all([
    desencriptar(creds.sol_usuario_enc),
    desencriptar(creds.sol_clave_enc),
  ]).catch(() => ['', ''])

  if (!solUsuario || !solClave) {
    return NextResponse.json({ error: 'Error al descifrar las credenciales SOL' }, { status: 500 })
  }

  // 5. Registrar empresa en Lycet (idempotente)
  const FE_BETA_URL = 'https://e-beta.sunat.gob.pe/ol-ti-itcpgem-beta/billService'
  const ensureRes = await ensureCompany(lycetCfg, {
    ruc:     creds.ruc,
    solUser: solUsuario,
    solPass: solClave,
    certPem,
    feUrl:   creds.modo === 'beta' ? FE_BETA_URL : undefined,
  })
  if (!ensureRes.ok) {
    return NextResponse.json(
      { error: `Error configurando el servicio de facturación: ${ensureRes.error}` },
      { status: 503 },
    )
  }

  // 6. Construir y enviar el Summary a Lycet
  const emisor = {
    ruc:         creds.ruc,
    razonSocial: creds.razon_social,
    direccion:   creds.direccion ?? '-',
  }

  const summaryDoc = mapearResumenDiario(
    fecha,
    correlativo,
    emisor,
    boletas.map(b => ({
      serie:    b.serie,
      numero:   b.numero,
      subtotal: b.subtotal ?? 0,
      igv:      b.igv ?? 0,
      total:    b.total ?? 0,
    })),
  )

  const resultado = await enviarSummary(lycetCfg, summaryDoc)

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error ?? 'Error en Lycet al enviar el Resumen Diario' },
      { status: 400 },
    )
  }

  // 7. Guardar el RC en BD
  const boletasTotal = boletas.reduce((acc, b) => acc + (b.total ?? 0), 0)
  const { data: rc, error: rcError } = await supabase
    .from('sunat_resumenes_diarios')
    .insert({
      ferreteria_id:  session.ferreteriaId,
      fecha,
      correlativo,
      ticket:         resultado.ticket ?? null,
      estado:         'enviado',
      boletas_count:  boletas.length,
      boletas_total:  boletasTotal,
    })
    .select('id, ticket, correlativo')
    .single()

  if (rcError) {
    return NextResponse.json(
      { error: 'RC enviado a SUNAT pero error al guardarlo: ' + rcError.message },
      { status: 500 },
    )
  }

  // Anti-duplicado: marcar boletas como declaradas
  if (rc?.id) {
    await supabase
      .from('comprobantes')
      .update({ rc_id: rc.id })
      .in('id', boletas.map(b => b.id))
  }

  return NextResponse.json({
    ok:            true,
    ticket:        resultado.ticket,
    correlativo,
    rc_id:         rc?.id,
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

  if (!rc)         return NextResponse.json({ error: 'RC no encontrado' }, { status: 404 })
  if (!rc.ticket)  return NextResponse.json({ error: 'Este RC no tiene ticket SUNAT para consultar' }, { status: 400 })

  const { data: creds } = await supabase
    .from('sunat_credenciales')
    .select('ruc, sol_usuario_enc, sol_clave_enc, cert_pfx_enc, cert_clave_enc, cert_pem_enc, modo')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!creds) return NextResponse.json({ error: 'Credenciales SUNAT no encontradas' }, { status: 400 })

  let lycetCfg: LycetConfig
  try { lycetCfg = getLycetConfig() }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 503 }) }

  const resultado = await consultarSummary(lycetCfg, rc.ticket, creds.ruc)

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  const code = resultado.cdrCodigo
  const n    = code != null && /^\d+$/.test(code) ? parseInt(code, 10) : NaN
  const nuevoEstado = code === '0' || (!Number.isNaN(n) && n >= 4000) ? 'aceptado' : 'rechazado'

  await supabase
    .from('sunat_resumenes_diarios')
    .update({
      estado:          nuevoEstado,
      cdr_codigo:      resultado.cdrCodigo,
      cdr_descripcion: resultado.cdrDescripcion,
      consultado_at:   new Date().toISOString(),
    })
    .eq('id', body.rc_id)

  // Si SUNAT rechazó, liberar las boletas para poder re-declararlas
  if (nuevoEstado === 'rechazado') {
    await supabase
      .from('comprobantes')
      .update({ rc_id: null })
      .eq('rc_id', body.rc_id)
  }

  return NextResponse.json({
    ok:              true,
    estado:          nuevoEstado,
    cdr_codigo:      resultado.cdrCodigo,
    cdr_descripcion: resultado.cdrDescripcion,
  })
}
