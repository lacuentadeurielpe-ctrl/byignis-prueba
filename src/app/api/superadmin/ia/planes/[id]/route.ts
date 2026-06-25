// PATCH  /api/superadmin/ia/planes/[id] — edita un plan
// DELETE /api/superadmin/ia/planes/[id] — desactiva un plan

import { NextResponse }           from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient }      from '@/lib/supabase/admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body   = await request.json()

  const campos: Record<string, unknown> = {}
  if (body.nombre         !== undefined) campos.nombre         = String(body.nombre).trim()
  if (body.creditos_mes   !== undefined) campos.creditos_mes   = Number(body.creditos_mes)
  if (body.precio_mensual !== undefined) campos.precio_mensual = Number(body.precio_mensual)
  if (body.precio_exceso  !== undefined) campos.precio_exceso  = Number(body.precio_exceso)
  if (body.activo         !== undefined) campos.activo         = Boolean(body.activo)

  if (Object.keys(campos).length === 0) {
    return NextResponse.json({ error: 'Sin campos a actualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('planes')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params

  // Verificar que no tenga suscripciones activas
  const admin = createAdminClient()
  const { count } = await admin
    .from('suscripciones')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id)
    .eq('estado', 'activo')

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `No se puede desactivar: tiene ${count} suscripción(es) activa(s)` },
      { status: 409 }
    )
  }

  const { error } = await admin
    .from('planes')
    .update({ activo: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
