// PATCH  /api/superadmin/ia/precios/[id]  — actualiza un paquete de créditos
// DELETE /api/superadmin/ia/precios/[id]  — desactiva un paquete

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body   = await request.json()
  const admin  = createAdminClient()

  // Si se marca como default, limpiar el anterior
  if (body.es_default === true) {
    await admin
      .from('tarifas_creditos')
      .update({ es_default: false, updated_at: new Date().toISOString() })
      .eq('es_default', true)
      .neq('id', id)
  }

  const campos: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.nombre      !== undefined) campos.nombre      = String(body.nombre).trim()
  if (body.tipo        !== undefined) campos.tipo        = String(body.tipo)
  if (body.creditos    !== undefined) campos.creditos    = Number(body.creditos)
  if (body.precio_usd  !== undefined) campos.precio_usd  = Number(body.precio_usd)
  if (body.precio_pen  !== undefined) campos.precio_pen  = body.precio_pen != null ? Number(body.precio_pen) : null
  if (body.es_default  !== undefined) campos.es_default  = Boolean(body.es_default)
  if (body.activo      !== undefined) campos.activo      = Boolean(body.activo)
  if (body.descripcion !== undefined) campos.descripcion = body.descripcion?.trim() ?? null

  const { data, error } = await admin
    .from('tarifas_creditos')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ precio: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const admin  = createAdminClient()

  // No se puede eliminar el default activo
  const { data: existing } = await admin
    .from('tarifas_creditos')
    .select('es_default')
    .eq('id', id)
    .single()

  if (existing?.es_default) {
    return NextResponse.json({ error: 'No se puede desactivar el plan default' }, { status: 400 })
  }

  const { error } = await admin
    .from('tarifas_creditos')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
