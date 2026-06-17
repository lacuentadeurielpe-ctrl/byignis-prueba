/**
 * POST /api/delivery/[token]/agenda/promedio
 * El repartidor actualiza su duración de bloque promedio (el ancho con el que
 * se encadenan los pedidos nuevos). Se afina a mano comparando con su real.
 *
 * body: { minutos }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setDuracionBloqueDefault } from '@/lib/delivery/agenda/repository'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = adminClient()

  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, ferreteria_id')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const minutos = Number(body.minutos)
  if (!Number.isFinite(minutos) || minutos <= 0) {
    return NextResponse.json({ error: 'minutos inválido' }, { status: 400 })
  }

  await setDuracionBloqueDefault(supabase, repartidor.ferreteria_id, repartidor.id, minutos)

  return NextResponse.json({ ok: true })
}
