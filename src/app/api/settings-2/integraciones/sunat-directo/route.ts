import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { encriptar, desencriptar } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// ── GET: cargar estado actual de la integración ───────────────────────────────
export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('sunat_credenciales')
    .select('id, ruc, razon_social, modo, estado, greenter_url, ultimo_test_at, ultimo_error, homologacion_casos_completados, homologacion_completada_at')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  // Leer proveedor_facturacion activo + datos del negocio como fallback
  const { data: ferr } = await supabase
    .from('ferreterias')
    .select('proveedor_facturacion, ruc, razon_social')
    .eq('id', session.ferreteriaId)
    .single()

  return NextResponse.json({
    configurado: !!data,
    proveedor_activo: ferr?.proveedor_facturacion ?? 'nubefact',
    credenciales: data ?? null,
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
    ruc:          string
    razon_social: string
    sol_usuario:  string
    sol_clave:    string
    cert_pfx_b64: string  // base64 del archivo .pfx/.p12
    cert_clave:   string
    greenter_url?: string
    modo:         'beta' | 'produccion'
  }

  const { ruc, razon_social, sol_usuario, sol_clave, cert_pfx_b64, cert_clave, modo } = body

  if (!ruc || !razon_social || !sol_usuario || !sol_clave || !cert_pfx_b64 || !cert_clave) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
  }

  const rucLimpio = ruc.replace(/\D/g, '')
  if (rucLimpio.length !== 11) {
    return NextResponse.json({ error: 'El RUC debe tener 11 dígitos' }, { status: 400 })
  }

  try {
    const [solUsuarioEnc, solClaveEnc, certPfxEnc, certClaveEnc] = await Promise.all([
      encriptar(sol_usuario),
      encriptar(sol_clave),
      encriptar(cert_pfx_b64),
      encriptar(cert_clave),
    ])

    const { data, error } = await supabase
      .from('sunat_credenciales')
      .upsert({
        ferreteria_id:  session.ferreteriaId,
        ruc:            rucLimpio,
        razon_social:   razon_social.trim(),
        sol_usuario_enc: solUsuarioEnc,
        sol_clave_enc:  solClaveEnc,
        cert_pfx_enc:   certPfxEnc,
        cert_clave_enc: certClaveEnc,
        greenter_url:   body.greenter_url?.trim() || 'https://greenter-api.byignis.com',
        modo:           modo ?? 'beta',
        estado:         'pendiente',
      }, { onConflict: 'ferreteria_id' })
      .select('id, ruc, razon_social, modo, estado')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, credenciales: data })
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

  // Revertir proveedor a nubefact
  await supabase
    .from('ferreterias')
    .update({ proveedor_facturacion: 'nubefact' })
    .eq('id', session.ferreteriaId)

  return NextResponse.json({ ok: true })
}
