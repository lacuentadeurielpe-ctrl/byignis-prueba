// GET  /api/superadmin/config     — lista todas las claves
// PATCH /api/superadmin/config    — actualiza una o más claves

import { NextResponse } from 'next/server'
import { verificarSuperadminAPI, requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const session = await verificarSuperadminAPI(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('config_plataforma')
    .select('clave, valor, descripcion, actualizado_at, actualizado_por')
    .order('clave')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { clave, valor } = body as { clave: string; valor: unknown }

  if (!clave) return NextResponse.json({ error: 'clave requerida' }, { status: 400 })
  if (valor === undefined) return NextResponse.json({ error: 'valor requerido' }, { status: 400 })

  const admin = createAdminClient()

  const { error } = await admin.from('config_plataforma').upsert({
    clave,
    valor,
    actualizado_at:  new Date().toISOString(),
    actualizado_por: session.superadminId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('superadmin_audit_log').insert({
    superadmin_id: session.superadminId,
    accion:        'guardar_config',
    recurso_tipo:  'config',
    recurso_id:    clave,
    metadata:      { valor },
    ip:            request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
