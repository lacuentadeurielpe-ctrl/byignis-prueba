// PATCH /api/repartidores/[id]/asignar — asigna este repartidor a un pedido
// Body: { pedidoId: string }
//
// Para pedidos delivery en 'en_preparacion', asignar repartidor TAMBIÉN avanza
// el estado a 'enviado' (dispara la transición real con notificación al cliente)
// y crea el registro de entrega. Antes solo escribía repartidor_id y el pedido
// quedaba congelado.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { OrderStateService } from '@/lib/services/order-state.service'

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
  const ventasRepo = new VentasRepository(supabase)

  // Verificar que el repartidor pertenece a la ferretería y está activo
  let repartidor
  try {
    repartidor = await deliveryRepo.obtenerRepartidorActivo(session.ferreteriaId, repartidorId)
  } catch (error) {
    return NextResponse.json({ error: 'Repartidor no encontrado' }, { status: 404 })
  }

  try {
    // 1. Asignar repartidor al pedido
    const data = await deliveryRepo.asignarRepartidorAPedido(session.ferreteriaId, pedidoId, repartidorId)

    // 2. Cargar el pedido para decidir si corresponde avanzar el estado
    const pedido = await ventasRepo.obtenerPedidoPorId(session.ferreteriaId, pedidoId)

    let estadoFinal = pedido?.estado ?? null

    // 3. Si es delivery y está listo para salir, avanzar a 'enviado'
    if (pedido && pedido.modalidad === 'delivery' && pedido.estado === 'en_preparacion') {
      const stateService = new OrderStateService(supabase, session.ferreteriaId, session.userId)
      await stateService.transicionarPedido(pedidoId, { type: 'ENVIAR' })
      estadoFinal = 'enviado'

      // 4. Crear registro de entrega (si la tabla/zona aplican). No bloqueante.
      try {
        await supabase.from('entregas').insert({
          ferreteria_id: session.ferreteriaId,
          pedido_id: pedidoId,
          zona_delivery_id: pedido.zona_delivery_id ?? null,
          repartidor_id: repartidorId,
          estado: 'asignado',
          direccion_entrega: pedido.direccion_entrega ?? 'Sin dirección especificada',
        })
      } catch (e) {
        console.error('No se pudo crear el registro de entrega:', e)
      }
    }

    return NextResponse.json({ ...data, estado: estadoFinal, repartidor })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
