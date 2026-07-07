import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { getContextoSucursal, COOKIE_LOCAL_ACTIVO } from '@/lib/sucursales/contexto'

export const dynamic = 'force-dynamic'

// POST /api/sucursales/activa — cambia la sucursal activa del usuario.
// body: { localId: string | null }  (null = "Todas", solo si no está fijado)
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { localId?: string | null }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const supabase = await createClient()
  const contexto = await getContextoSucursal(supabase, session)

  if (contexto.localFijado) {
    return NextResponse.json({ error: 'Tu cuenta está asignada a una sucursal fija' }, { status: 403 })
  }

  const cookieStore = await cookies()

  if (body.localId == null) {
    // "Todas" — se borra la cookie
    cookieStore.delete(COOKIE_LOCAL_ACTIVO)
    return NextResponse.json({ ok: true, localActivoId: null })
  }

  // Doble validación: el local existe, pertenece al tenant Y es visible para el usuario
  const permitido = contexto.localesVisibles.some(l => l.id === body.localId)
  if (!permitido) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  cookieStore.set(COOKIE_LOCAL_ACTIVO, body.localId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365, // 1 año — preferencia de trabajo, no credencial
    path: '/',
  })

  return NextResponse.json({ ok: true, localActivoId: body.localId })
}
