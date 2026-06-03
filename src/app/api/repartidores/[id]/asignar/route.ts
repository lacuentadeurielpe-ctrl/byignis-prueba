// PATCH /api/repartidores/[id]/asignar — asigna este repartidor a un pedido
// Body: { pedidoId: string }
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: repartidorId } = await params
  const body = await request.json()
  const { pedidoId } = body

  if (!pedidoId) return NextResponse.json({ error: 'pedidoId requerido' }, { status: 400 })

  const supabase = await createClient()
  const deliveryRepo = new DeliveryRepository(supabase)

  // Verificar que el repartidor pertenece a la ferretería y está activo
  let repartidor
  try {
    repartidor = await deliveryRepo.obtenerRepartidorActivo(session.ferreteriaId, repartidorId)
  } catch (error) {
    return NextResponse.json({ error: 'Repartidor no encontrado' }, { status: 404 })
  }

  // Asignar al pedido (debe ser de esta ferretería)
  try {
    const data = await deliveryRepo.asignarRepartidorAPedido(session.ferreteriaId, pedidoId, repartidorId)
    return NextResponse.json({ ...data, repartidor })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
