import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const data = await req.json()
    const supabase = await createClient()

    // Solo actualizar los campos permitidos
    const updatePayload: any = {}
    if (data.estado) updatePayload.estado = data.estado
    if (data.titulo) updatePayload.titulo = data.titulo
    if (data.valor_estimado !== undefined) updatePayload.valor_estimado = data.valor_estimado
    if (data.probabilidad_cierre !== undefined) updatePayload.probabilidad_cierre = data.probabilidad_cierre

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No hay datos para actualizar' }, { status: 400 })
    }

    const { data: op, error } = await supabase
      .from('crm_oportunidades')
      .update(updatePayload)
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(op)
  } catch (err: any) {
    console.error('Error actualizando oportunidad:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
