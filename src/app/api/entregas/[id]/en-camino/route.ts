import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// PATCH /api/entregas/[id]/en-camino — Marcar entrega como en camino
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  // 1. Verificar que entrega pertenece a la ferretería
  const { data: entrega, error: errEntrega } = await supabase
    .from('entregas')
    .select('id, ferreteria_id, repartidor_id, estado')
    .eq('id', id)
    .single()

  if (errEntrega || !entrega) {
    return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
  }

  if (entrega.ferreteria_id !== session.ferreteriaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!entrega.repartidor_id) {
    return NextResponse.json(
      { error: 'Entrega debe estar asignada a un repartidor antes de salir' },
      { status: 400 }
    )
  }

  if (entrega.estado === 'en_camino' || entrega.estado === 'entregado') {
    return NextResponse.json(
      { error: `No se puede cambiar estado desde '${entrega.estado}'` },
      { status: 400 }
    )
  }

  // 2. Actualizar a "en camino" con timestamp
  const { data, error } = await supabase
    .from('entregas')
    .update({
      estado: 'en_camino',
      salio_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    entrega: data,
    message: 'Repartidor salió hacia el cliente'
  })
}
