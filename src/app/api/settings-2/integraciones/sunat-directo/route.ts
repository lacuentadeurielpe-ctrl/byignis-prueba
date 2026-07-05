import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { encriptar, desencriptar } from '@/lib/encryption'
import { pfxAPem } from '@/lib/facturacion/lycet/cert'
import { ensureCompany } from '@/lib/facturacion/lycet/client'

export const dynamic = 'force-dynamic'

// ── GET: cargar estado actual de la integración ───────────────────────────────
export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('sunat_credenciales')
    .select('id, ruc, razon_social, modo, estado, greenter_url, ultimo_test_at, ultimo_error, homologacion_casos_completados, homologacion_completada_at, sol_usuario_enc')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  // Leer proveedor_facturacion activo + datos del negocio como fallback
  const { data: ferr } = await supabase
    .from('ferreterias')
    .select('proveedor_facturacion, ruc, razon_social')
    .eq('id', session.ferreteriaId)
    .single()

  // Descifrar usuario SOL para mostrarlo en el formulario (no es dato secreto — la clave SOL sí lo es)
  let solUsuario: string | null = null
  if (data?.sol_usuario_enc) {
    try { solUsuario = await desencriptar(data.sol_usuario_enc) } catch { /* ignorar */ }
  }

  // Excluir sol_usuario_enc del objeto de respuesta
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sol_usuario_enc: _omit, ...credsSinEnc } = data ?? {}

  return NextResponse.json({
    configurado: !!data,
    proveedor_activo: ferr?.proveedor_facturacion ?? 'sunat_directo',
    credenciales: data ? { ...credsSinEnc, sol_usuario: solUsuario } : null,
    // Datos pre-existentes del negocio para pre-llenar cuando no hay credenciales SUNAT aún
    negocio_ruc:          ferr?.ruc ?? null,
    negocio_razon_social: ferr?.razon_social ?? null,
  })
}

// ── POST: guardar/actualizar credenciales SUNAT ───────────────────────────────
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  const body = await request.json() as {
    sol_usuario:  string
    sol_clave:    string
    cert_pfx_b64?: string
    cert_clave:   string
    modo:         'beta' | 'produccion'
  }

  const { sol_usuario, sol_clave, cert_pfx_b64, cert_clave, modo } = body

  if (!sol_usuario || !sol_clave || !cert_clave) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
  }

  // RUC y Razón Social vienen de ferreterias — fuente única de verdad
  const { data: ferr } = await supabase
    .from('ferreterias')
    .select('ruc, razon_social')
    .eq('id', session.ferreteriaId)
    .single()

  if (!ferr?.ruc || !ferr?.razon_social) {
    return NextResponse.json({ error: 'Configura el RUC y razón social en Configuración → Negocio primero' }, { status: 400 })
  }

  const rucLimpio = ferr.ruc.replace(/\D/g, '')
  if (rucLimpio.length !== 11) {
    return NextResponse.json({ error: 'El RUC en Negocio no tiene 11 dígitos — corrígelo allí primero' }, { status: 400 })
  }

  // Verificar si ya hay credenciales (para actualización sin re-subir el certificado)
  const { data: existing } = await supabase
    .from('sunat_credenciales')
    .select('cert_pfx_enc, modo, homologacion_completada_at')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!cert_pfx_b64 && !existing) {
    return NextResponse.json({ error: 'Debes subir el certificado digital (.pfx/.p12)' }, { status: 400 })
  }

  try {
    const encPromises: Promise<string>[] = [
      encriptar(sol_usuario),
      encriptar(sol_clave),
      encriptar(cert_clave),
    ]
    if (cert_pfx_b64) encPromises.push(encriptar(cert_pfx_b64))
    const [solUsuarioEnc, solClaveEnc, certClaveEnc, certPfxEnc] = await Promise.all(encPromises)

    const modoFinal = existing?.homologacion_completada_at ? 'produccion' : (modo ?? 'beta')

    const certPfxFinal = certPfxEnc ?? existing?.cert_pfx_enc
    if (!certPfxFinal) {
      return NextResponse.json({ error: 'Debes subir el certificado digital (.pfx/.p12)' }, { status: 400 })
    }

    // Convertir PFX → PEM para Lycet (solo si se subió un cert nuevo)
    let certPemEnc: string | undefined
    let certVenceAt: string | undefined
    if (cert_pfx_b64) {
      try {
        const convertido = pfxAPem(cert_pfx_b64, cert_clave)
        const [pemEnc] = await Promise.all([encriptar(convertido.pem)])
        certPemEnc = pemEnc
        certVenceAt = convertido.venceAt.toISOString()
      } catch (e: any) {
        return NextResponse.json({ error: e.message ?? 'Error al procesar el certificado digital' }, { status: 400 })
      }
    }

    const upsertPayload: any = {
      ferreteria_id:   session.ferreteriaId,
      ruc:             rucLimpio,
      razon_social:    ferr.razon_social.trim(),
      sol_usuario_enc: solUsuarioEnc,
      sol_clave_enc:   solClaveEnc,
      cert_pfx_enc:    certPfxFinal,
      cert_clave_enc:  certClaveEnc,
      modo:            modoFinal,
      estado:          'pendiente',
    }

    if (certPemEnc)  upsertPayload.cert_pem_enc  = certPemEnc
    if (certVenceAt) upsertPayload.cert_vence_at = certVenceAt

    const { data, error } = await supabase
      .from('sunat_credenciales')
      .upsert(upsertPayload, { onConflict: 'ferreteria_id' })
      .select('id, ruc, razon_social, modo, estado')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Registrar empresa en Lycet (idempotente — falla en silencio, no bloquea el guardado)
    const lycetUrl   = process.env.LYCET_BASE_URL
    const lycetToken = process.env.LYCET_API_TOKEN
    let lycetOk = false
    let lycetError: string | undefined
    if (lycetUrl && lycetToken && certPemEnc) {
      // Desencriptar el PEM recién guardado para pasarlo a Lycet
      const certPem = await desencriptar(certPemEnc)
      const res = await ensureCompany(
        { baseUrl: lycetUrl, token: lycetToken },
        {
          ruc:     rucLimpio,
          solUser: sol_usuario,
          solPass: sol_clave,
          certPem,
          feUrl:   modoFinal === 'beta'
            ? 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService'
            : undefined,
        },
      )
      lycetOk    = res.ok
      lycetError = res.error
    }

    return NextResponse.json({ ok: true, credenciales: data, lycet: { ok: lycetOk, error: lycetError } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al guardar credenciales' }, { status: 500 })
  }
}

// ── PATCH: cambiar proveedor activo + modo ────────────────────────────────────
export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const body = await request.json() as { proveedor?: string; modo?: 'beta' | 'produccion' }

  const updates: any = {}
  if (body.proveedor) updates.proveedor_facturacion = body.proveedor

  if (Object.keys(updates).length > 0) {
    await supabase.from('ferreterias').update(updates).eq('id', session.ferreteriaId)
  }

  if (body.modo) {
    await supabase
      .from('sunat_credenciales')
      .update({ modo: body.modo })
      .eq('ferreteria_id', session.ferreteriaId)
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE: eliminar credenciales SUNAT ──────────────────────────────────────
export async function DELETE() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  await supabase
    .from('sunat_credenciales')
    .delete()
    .eq('ferreteria_id', session.ferreteriaId)

  // SUNAT Directo es el único proveedor: desconectar solo borra credenciales.
  // El negocio queda sin facturación electrónica hasta volver a configurarlas.

  return NextResponse.json({ ok: true })
}
