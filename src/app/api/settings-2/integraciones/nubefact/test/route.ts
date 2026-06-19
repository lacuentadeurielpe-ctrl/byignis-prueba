import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('integraciones_conectadas')
    .select('metadata, estado')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'nubefact')
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Nubefact no configurado' }, { status: 400 })

  const token = row.metadata?.token
  const modo  = row.metadata?.modo ?? 'prueba'
  if (!token) return NextResponse.json({ error: 'Token de Nubefact no encontrado' }, { status: 400 })

  const baseUrl = modo === 'produccion'
    ? 'https://app.nubefact.com/api/v1'
    : 'https://demo.nubefact.com/api/v1'

  try {
    const res = await fetch(`${baseUrl}/company`, {
      headers: {
        Authorization: `Token token=${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: 'Token de Nubefact inválido o sin permisos' }, { status: 400 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Nubefact respondió con ${res.status}` }, { status: 400 })
    }

    const data = await res.json()
    return NextResponse.json({ ok: true, message: `Token válido — empresa: ${data?.razon_social ?? 'OK'}`, modo })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error conectando con Nubefact' }, { status: 500 })
  }
}
