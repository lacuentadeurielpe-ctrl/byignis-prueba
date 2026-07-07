import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { getContextoSucursal } from '@/lib/sucursales/contexto'

export const dynamic = 'force-dynamic'

// GET /api/sucursales — contexto de sucursal del usuario (para el selector)
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const contexto = await getContextoSucursal(supabase, session)

  return NextResponse.json(contexto)
}

// PATCH /api/sucursales — activa/desactiva el modo multi-sucursal (solo dueño)
export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.rol !== 'dueno') {
    return NextResponse.json({ error: 'Solo el dueño puede cambiar el modo multi-sucursal' }, { status: 403 })
  }

  let body: { multiSucursal?: boolean }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (typeof body.multiSucursal !== 'boolean') {
    return NextResponse.json({ error: 'multiSucursal debe ser booleano' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ferreterias')
    .update({ multi_sucursal: body.multiSucursal })
    .eq('id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, multiSucursal: body.multiSucursal })
}
