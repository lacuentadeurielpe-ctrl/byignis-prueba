// PATCH /api/superadmin/ia/facturas/[id]  — cambiar estado o notas de una factura

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

const ESTADOS_VALIDOS = ['borrador', 'emitida', 'archivada']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body   = await request.json()
  const admin  = createAdminClient()

  const campos: Record<string, unknown> = {}

  if (body.estado !== undefined) {
    if (!ESTADOS_VALIDOS.includes(body.estado)) {
      return NextResponse.json({ error: 'estado inválido: borrador | emitida | archivada' }, { status: 400 })
    }
    campos.estado = body.estado
    if (body.estado === 'emitida') campos.emitida_at = new Date().toISOString()
  }

  if (body.notas !== undefined) {
    campos.notas = body.notas?.trim() ?? null
  }

  if (Object.keys(campos).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('facturas_gasto_ia')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ factura: data })
}
