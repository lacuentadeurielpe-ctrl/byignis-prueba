import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { getAccessTokenTenantMP } from '@/lib/integrations/mercadopago-tenant'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { token: accessToken, motivo } = await getAccessTokenTenantMP(supabase, session.ferreteriaId)

  if (!accessToken) {
    return NextResponse.json(
      {
        error: motivo === 'error_descifrado'
          ? 'No pudimos leer las credenciales guardadas. Vuelve a conectar tu cuenta de Mercado Pago.'
          : 'MercadoPago no configurado',
      },
      { status: 400 },
    )
  }

  try {
    const res = await fetch('https://api.mercadopago.com/v1/account/bank_report/config', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.status === 401) return NextResponse.json({ error: 'Access token inválido o expirado' }, { status: 400 })
    if (!res.ok && res.status !== 404) {
      return NextResponse.json({ error: `MercadoPago respondió con ${res.status}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: 'Credenciales de MercadoPago válidas' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error verificando token' }, { status: 500 })
  }
}
