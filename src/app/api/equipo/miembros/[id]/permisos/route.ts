// PATCH /api/equipo/miembros/[id]/permisos
// Guarda los permisos granulares de un miembro del equipo.
// Solo dueños o miembros con gestionar_empleados pueden hacerlo.

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { checkPermiso } from '@/lib/auth/permisos'
import { normalizarPermisos } from '@/lib/auth/permisos'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Solo dueños o quien tenga gestionar_empleados
  if (session.rol !== 'dueno' && !checkPermiso(session, 'gestionar_empleados')) {
    return NextResponse.json({ error: 'Sin permiso para gestionar empleados' }, { status: 403 })
  }

  const { id } = await params

  let body: { permisos?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.permisos || typeof body.permisos !== 'object') {
    return NextResponse.json({ error: 'permisos es requerido' }, { status: 400 })
  }

  const permisosNormalizados = normalizarPermisos(body.permisos as Record<string, unknown>)

  const supabase = await createClient()

  // Verificar que el miembro pertenece a esta ferretería (seguridad RLS + extra check)
  const { data: miembro, error: fetchError } = await supabase
    .from('miembros_ferreteria')
    .select('id, rol')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (fetchError || !miembro) {
    return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  }

  // No se pueden modificar permisos del dueño
  if (miembro.rol === 'dueno') {
    return NextResponse.json({ error: 'No se pueden modificar los permisos del dueño' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('miembros_ferreteria')
    .update({ permisos: permisosNormalizados })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, permisos: permisosNormalizados })
}
