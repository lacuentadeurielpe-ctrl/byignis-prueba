import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('integraciones_conectadas')
    .select('metadata')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'mercadopago')
    .eq('estado', 'conectado')
    .maybeSingle()

  const accessToken = row?.metadata?.access_token
  if (!accessToken) return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 400 })

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
