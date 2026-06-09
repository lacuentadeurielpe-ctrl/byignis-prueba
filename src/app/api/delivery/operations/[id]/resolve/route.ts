/**
 * PATCH /api/delivery/operations/[id]/resolve
 * Marca un registro del log de operaciones como resuelto.
 * Puede incluir notas de resolución opcionales.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const supabase = await createClient()

  // Verificar que el log pertenece a la ferretería
  const { data: log } = await supabase
    .from('delivery_operaciones_log')
    .select('id, resuelto')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!log) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  if (log.resuelto) return NextResponse.json({ ok: true, mensaje: 'Ya estaba resuelto' })

  const { error } = await supabase
    .from('delivery_operaciones_log')
    .update({
      resuelto:     true,
      resuelto_at:  new Date().toISOString(),
      resuelto_por: session.userId,
    })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
