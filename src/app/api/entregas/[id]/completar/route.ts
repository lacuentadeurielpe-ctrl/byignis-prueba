import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

interface CompletarRequest {
  nota?: string
  firma_url?: string
  fotos?: string[]
}

// PATCH /api/entregas/[id]/completar — Marcar entrega como completada
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const body: CompletarRequest = await request.json().catch(() => ({}))

  // 1. Verificar que entrega pertenece a la ferretería
  const { data: entrega, error: errEntrega } = await supabase
    .from('entregas')
    .select('id, ferreteria_id, pedido_id, estado, salio_at')
    .eq('id', id)
    .single()

  if (errEntrega || !entrega) {
    return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
  }

  if (entrega.ferreteria_id !== session.ferreteriaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (entrega.estado === 'entregado' || entrega.estado === 'cancelado') {
    return NextResponse.json(
      { error: `Entrega ya está marcada como '${entrega.estado}'` },
      { status: 400 }
    )
  }

  // 2. Calcular duración real si salió
  let duracion_real_min = null
  if (entrega.salio_at) {
    const ahora = new Date()
    const salio = new Date(entrega.salio_at)
    duracion_real_min = Math.round((ahora.getTime() - salio.getTime()) / 60000)
  }

  // 3. Actualizar entrega a completada
  const { data: entregaUpdated, error: errUpdate } = await supabase
    .from('entregas')
    .update({
      estado: 'entregado',
      llego_at: new Date().toISOString(),
      nota_entrega: body.nota || null,
      firma_cliente_url: body.firma_url || null,
      comprobante_fotos: body.fotos || [],
      duracion_real_min
    })
    .eq('id', id)
    .select()
    .single()

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })
  }

  // 4. Actualizar pedido a "entregado"
  const { error: errPedido } = await supabase
    .from('pedidos')
    .update({ estado: 'entregado' })
    .eq('id', entrega.pedido_id)

  if (errPedido) {
    console.error('Error actualizando pedido:', errPedido)
    // No retornamos error aquí para que la entrega quede completada aunque falle el pedido
  }

  return NextResponse.json({
    success: true,
    entrega: entregaUpdated,
    message: 'Entrega completada correctamente',
    duracion_min: duracion_real_min
  })
}
