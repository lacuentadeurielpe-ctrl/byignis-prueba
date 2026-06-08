import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { OrdersService, PedidoPayload } from '@/lib/services/orders.service'

export const dynamic = 'force-dynamic'

// POST /api/orders — crear pedido
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ordersService = new OrdersService(supabase, session.ferreteriaId, session.userId)

  try {
    const body: PedidoPayload = await request.json()
    const pedido = await ordersService.crearPedido(body)
    // Obtener el pedido completo con relaciones para la UI
    const ventasRepo = new VentasRepository(supabase)
    const pedidoCompleto = await ventasRepo.obtenerPedidoPorId(session.ferreteriaId, pedido.id)
    return NextResponse.json(pedidoCompleto, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('requerid') ? 400 : 500 })
  }
}

// GET /api/orders
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')

  try {
    const data = await ventasRepo.obtenerPedidosPorFerreteria(session.ferreteriaId, estado)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
