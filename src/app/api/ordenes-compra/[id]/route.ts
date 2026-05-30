import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  // Solo permitimos actualizar el estado y las notas
  const { estado, notas } = body
  const updateData: any = {}
  if (estado !== undefined) updateData.estado = estado
  if (notas !== undefined) updateData.notas = notas

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ordenes_compra')
    .update(updateData)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  // Eliminar la orden. (Los items se eliminarán automáticamente por ON DELETE CASCADE)
  const { error } = await supabase
    .from('ordenes_compra')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
