// PATCH  /api/superadmin/ia/tarifas/[id]  — actualiza precios de un modelo IA
// DELETE /api/superadmin/ia/tarifas/[id]  — desactiva (soft-delete)

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidarCacheTarifas } from '@/lib/credits'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body   = await request.json()

  const campos: Record<string, unknown> = { actualizado_at: new Date().toISOString() }
  if (body.precio_entrada_por_1k    !== undefined) campos.precio_entrada_por_1k    = Number(body.precio_entrada_por_1k)
  if (body.precio_salida_por_1k    !== undefined) campos.precio_salida_por_1k    = Number(body.precio_salida_por_1k)
  if (body.precio_cobro_usd_por_1k !== undefined) campos.precio_cobro_usd_por_1k = Number(body.precio_cobro_usd_por_1k)
  if (body.precio_cobro_pen_por_1k !== undefined) campos.precio_cobro_pen_por_1k = Number(body.precio_cobro_pen_por_1k)
  if (body.proveedor               !== undefined) campos.proveedor               = String(body.proveedor).trim()
  if (body.unidad                  !== undefined) campos.unidad                  = String(body.unidad)
  if (body.notas                   !== undefined) campos.notas                   = body.notas ? String(body.notas).trim() : null
  if (body.activo                  !== undefined) campos.activo                  = Boolean(body.activo)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tarifas_ia')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidarCacheTarifas()
  return NextResponse.json({ tarifa: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const admin  = createAdminClient()

  const { error } = await admin
    .from('tarifas_ia')
    .update({ activo: false, actualizado_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidarCacheTarifas()
  return NextResponse.json({ ok: true })
}
