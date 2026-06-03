// GET  /api/creditos — lista créditos de la ferretería
// POST /api/creditos — crear crédito para un pedido
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { checkPermiso } from '@/lib/auth/permisos'
import { VentasRepository } from '@/lib/db/repositories/ventas'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!checkPermiso(session, 'ver_creditos')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)

  // Marcar automáticamente como vencidos los que pasaron fecha_limite
  // y sincronizar pedidos.estado_pago → 'credito_vencido' para visibilidad universal
  const hoy = new Date().toISOString().slice(0, 10)
  try {
    await ventasRepo.vencerCreditosAntiguos(session.ferreteriaId, hoy)
    const data = await ventasRepo.listarCreditosDashboard(session.ferreteriaId)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!checkPermiso(session, 'aprobar_creditos')) return NextResponse.json({ error: 'Sin permiso para aprobar créditos' }, { status: 403 })

  const body = await request.json()
  const { pedido_id, fecha_limite, notas } = body

  if (!pedido_id) return NextResponse.json({ error: 'pedido_id requerido' }, { status: 400 })
  if (!fecha_limite) return NextResponse.json({ error: 'fecha_limite requerido' }, { status: 400 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)

  // Verificar que el pedido pertenece a esta ferretería y tiene metodo_pago='credito'
  let pedido
  try {
    pedido = await ventasRepo.obtenerPedidoPorId(session.ferreteriaId, pedido_id)
  } catch (error) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  if (pedido.metodo_pago !== 'credito') return NextResponse.json({ error: 'El pedido no tiene método de pago crédito' }, { status: 400 })
  if (pedido.estado_pago === 'credito_activo') return NextResponse.json({ error: 'Este pedido ya tiene un crédito activo' }, { status: 400 })

  try {
    // Crear el crédito
    const credito = await ventasRepo.crearCredito(session.ferreteriaId, {
      clienteId: pedido.cliente_id,
      pedidoId: pedido_id,
      montoTotal: pedido.total,
      fechaLimite: fecha_limite,
      aprobadoPor: session.userId,
      notas: notas ?? null,
    })

    // Actualizar el estado_pago del pedido a credito_activo
    await ventasRepo.actualizarPagoPedido(session.ferreteriaId, pedido_id, {
      estado_pago: 'credito_activo',
      pago_confirmado_por: session.userId,
      pago_confirmado_at: new Date().toISOString(),
    })

    return NextResponse.json(credito, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
