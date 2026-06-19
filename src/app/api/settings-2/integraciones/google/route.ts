// GET: estado de la integración Google. DELETE: desconectar.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('integraciones_conectadas')
    .select('estado, conectado_at, metadata')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'google')
    .single()

  if (!data) return NextResponse.json({ estado: 'desconectado' })

  return NextResponse.json({
    estado:       data.estado,
    conectado_at: data.conectado_at,
    email:        (data.metadata as any)?.email,
    calendar_id:  (data.metadata as any)?.calendar_id ?? 'primary',
  })
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const supabase = await createClient()

  // Permite actualizar calendar_id y drive_folder_id sin re-autorizar
  const { data: existing } = await supabase
    .from('integraciones_conectadas')
    .select('metadata')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'google')
    .single()

  if (!existing) return NextResponse.json({ error: 'No conectado' }, { status: 404 })

  const updatedMeta = {
    ...(existing.metadata as object),
    ...(body.calendar_id      ? { calendar_id:      body.calendar_id }      : {}),
    ...(body.drive_folder_id  ? { drive_folder_id:  body.drive_folder_id }  : {}),
  }

  await supabase
    .from('integraciones_conectadas')
    .update({ metadata: updatedMeta })
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'google')

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  await supabase
    .from('integraciones_conectadas')
    .delete()
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('tipo', 'google')

  await supabase.from('integracion_logs').insert({
    ferreteria_id:    session.ferreteriaId,
    integracion_tipo: 'google',
    evento:           'desconectado',
    detalle:          'Google desconectado por el dueño',
    usuario_id:       session.userId,
  })

  return NextResponse.json({ ok: true })
}
