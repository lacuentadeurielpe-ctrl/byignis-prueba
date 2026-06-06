import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { OrdersService, PedidoPayload } from '@/lib/services/orders.service'
import { OrderStateService } from '@/lib/services/order-state.service'

const ESTADOS_VALIDOS = ['programado', 'pendiente', 'confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado', 'entregado', 'cancelado', 'devuelto']

// Mapea el string antiguo del frontend al evento de XState
function mapEstadoToEvent(estado: string, motivo?: string) {
  switch(estado) {
    case 'confirmado': return { type: 'CONFIRMAR' }
    case 'en_preparacion': return { type: 'PREPARAR' }
    case 'listo_para_recojo': return { type: 'LISTO_RECOJO' }
    case 'enviado': return { type: 'ENVIAR' }
    case 'entregado': return { type: 'ENTREGAR' }
    case 'cancelado': return { type: 'CANCELAR', motivo: motivo ?? 'Cancelado por usuario' }
    case 'devuelto': return { type: 'DEVOLVER' }
    default: return null
  }
}

// PATCH /api/orders/[id] — actualizar estado del pedido vía Máquina de Estados
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  if (body.estado && !ESTADOS_VALIDOS.includes(body.estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const stateService = new OrderStateService(supabase, session.ferreteriaId, session.userId)

  try {
    let data;
    if (body.estado) {
      const evento = mapEstadoToEvent(body.estado, body.motivo_cancelacion)
      if (!evento) throw new Error('Transición no soportada o estado inicial inválido')
      
      data = await stateService.transicionarPedido(id, evento, body.notas, body.motivo_cancelacion)
    } else if (body.notas !== undefined) {
      // Solo actualiza notas
      const ventasRepo = new VentasRepository(supabase)
      data = await ventasRepo.actualizarEstadoPedido(session.ferreteriaId, id, { notas: body.notas })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

// GET /api/orders/[id]
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)

  const { id } = await params
  try {
    const data = await ventasRepo.obtenerPedidoPorId(session.ferreteriaId, id)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}

// PUT /api/orders/[id] — editar pedido
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ordersService = new OrdersService(supabase, session.ferreteriaId, session.userId)
  const { id } = await params

  try {
    const body: PedidoPayload = await request.json()
    const data = await ordersService.editarPedido(id, body)
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.message.includes('No se puede editar un pedido con pago confirmado')) {
      return NextResponse.json({ error: error.message, codigo: 'PAGO_CONFIRMADO' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

// DELETE /api/orders/[id] — eliminar pedido
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)

  try {
    await ventasRepo.eliminarPedido(session.ferreteriaId, id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
