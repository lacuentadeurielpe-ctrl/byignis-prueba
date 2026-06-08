import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// DELETE /api/clientes/[id]/notas/[notaId] — eliminar nota
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; notaId: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id, notaId } = await params

  try {
    // Verificar que el cliente existe y pertenece a la ferretería
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Obtener la nota para verificar permisos
    const { data: nota } = await supabase
      .from('cliente_notas')
      .select('id, autor_id')
      .eq('id', notaId)
      .eq('cliente_id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    }

    // Solo el autor o el dueño pueden eliminar
    if (nota.autor_id !== session.userId && session.rol !== 'dueno') {
      return NextResponse.json({ error: 'No tienes permisos para eliminar esta nota' }, { status: 403 })
    }

    const { error } = await supabase
      .from('cliente_notas')
      .delete()
      .eq('id', notaId)
      .eq('cliente_id', id)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting nota:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(null, { status: 204 })
  } catch (err) {
    console.error('Error in DELETE /api/clientes/[id]/notas/[notaId]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
