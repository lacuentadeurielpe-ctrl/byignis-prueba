import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { desencriptar } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// POST /api/settings-2/integraciones/sunat-directo/test
// Llama al microservicio Greenter para verificar que las credenciales son válidas.
export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  const { data: creds } = await supabase
    .from('sunat_credenciales')
    .select('ruc, sol_usuario_enc, sol_clave_enc, cert_pfx_enc, cert_clave_enc, greenter_url, modo')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!creds) return NextResponse.json({ error: 'No hay credenciales SUNAT configuradas' }, { status: 400 })

  try {
    const [solUsuario, solClave, certPfxB64, certClave] = await Promise.all([
      desencriptar(creds.sol_usuario_enc),
      desencriptar(creds.sol_clave_enc),
      desencriptar(creds.cert_pfx_enc),
      desencriptar(creds.cert_clave_enc),
    ])

    const greenterUrl = creds.greenter_url ?? 'https://greenter-api.byignis.com'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    const res = await fetch(`${greenterUrl.replace(/\/$/, '')}/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modo:        creds.modo,
        ruc:         creds.ruc,
        sol:         { usuario: solUsuario, clave: solClave },
        certificado: { pfx_base64: certPfxB64, clave: certClave },
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    const json = await res.json().catch(() => ({ ok: false, error: 'Respuesta inválida del microservicio' }))

    // Actualizar estado en BD
    await supabase
      .from('sunat_credenciales')
      .update({
        ultimo_test_at: new Date().toISOString(),
        estado:         json.ok ? 'activo' : 'error',
        ultimo_error:   json.ok ? null : (json.error ?? 'Error desconocido'),
      })
      .eq('ferreteria_id', session.ferreteriaId)

    if (json.ok) {
      return NextResponse.json({ ok: true, message: 'Credenciales verificadas correctamente con SUNAT' })
    } else {
      return NextResponse.json({ ok: false, error: json.error ?? 'Error al verificar credenciales' }, { status: 400 })
    }
  } catch (err: any) {
    const msg = err.name === 'AbortError'
      ? 'Tiempo de espera agotado — verifica que el microservicio Greenter esté activo'
      : (err.message ?? 'Error interno')

    await supabase
      .from('sunat_credenciales')
      .update({ ultimo_test_at: new Date().toISOString(), estado: 'error', ultimo_error: msg })
      .eq('ferreteria_id', session.ferreteriaId)

    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
