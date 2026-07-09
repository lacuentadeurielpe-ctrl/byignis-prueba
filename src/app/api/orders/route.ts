import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { OrdersService, PedidoPayload } from '@/lib/services/orders.service'
import { getContextoSucursal } from '@/lib/sucursales/contexto'

export const dynamic = 'force-dynamic'

// POST /api/orders — crear pedido
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ordersService = new OrdersService(supabase, session.ferreteriaId, session.userId)

  try {
    const body: PedidoPayload = await request.json()
    // Sucursal de escritura: SIEMPRE resuelta por el servidor desde el contexto
    // (cookie/asignación del empleado). Se ignora cualquier local_id del cliente.
    if (session.multiSucursal) {
      const contexto = await getContextoSucursal(supabase, session)
      body.local_id = contexto.localEscrituraId || null
    } else {
      body.local_id = null
    }
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
    const contextoSucursal = session.multiSucursal ? await getContextoSucursal(supabase, session) : null
    const localActivoId = contextoSucursal?.localActivoId ?? null

    const data = await ventasRepo.obtenerPedidosPorFerreteria(session.ferreteriaId, estado, localActivoId)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
