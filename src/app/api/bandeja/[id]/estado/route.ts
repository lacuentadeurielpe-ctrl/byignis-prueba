import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/bandeja/[id]/estado
// Actualiza estado_atencion, archivada, fijada, snooze_hasta, asignado_a
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const supabase = await createClient()

  const permitidos = ['estado_atencion', 'archivada', 'fijada', 'snooze_hasta', 'asignado_a']
  const update: Record<string, unknown> = {}
  for (const k of permitidos) {
    if (k in body) update[k] = body[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin campos' }, { status: 400 })
  }

  const { error } = await supabase
    .from('conversaciones')
    .update(update)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
