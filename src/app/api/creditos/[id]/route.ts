// PATCH /api/creditos/[id] — editar campos editables de una deuda (fecha_limite, notas)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  // Solo dueño o vendedor con permiso puede editar deudas
  if (session.rol !== 'dueno') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  // Verificar que pertenece al tenant
  const { data: credito } = await supabase
    .from('creditos')
    .select('id, estado')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!credito) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
  if (credito.estado === 'pagado') return NextResponse.json({ error: 'No se puede editar una deuda ya cancelada' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  // Fecha límite: validar formato yyyy-mm-dd
  if (body.fecha_limite !== undefined) {
    const fecha = body.fecha_limite
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Formato de fecha inválido (usa YYYY-MM-DD)' }, { status: 400 })
    }
    const d = new Date(fecha + 'T00:00:00')
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    }
    updates.fecha_limite = fecha
  }

  // Notas
  if (body.notas !== undefined) {
    updates.notas = body.notas?.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('creditos')
    .update(updates)
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .select('id, fecha_limite, notas, estado')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
