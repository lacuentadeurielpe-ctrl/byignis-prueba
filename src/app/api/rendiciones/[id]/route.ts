// GET /api/rendiciones/[id] — detalle de una rendición: pedidos que la componen
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { checkPermiso } from '@/lib/auth/permisos'
import { limaDiaAUTC } from '@/lib/tiempo'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!checkPermiso(session, 'ver_caja_dia')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const supabase = await createClient()

  // Cargar la rendición para obtener repartidor + fecha
  const { data: rendicion, error: errRend } = await supabase
    .from('rendiciones')
    .select('id, repartidor_id, fecha, monto_esperado, monto_recibido')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errRend || !rendicion) {
    return NextResponse.json({ error: 'Rendición no encontrada' }, { status: 404 })
  }

  // Re-consultar los pedidos del mismo día/repartidor usando updated_at (fecha de entrega real)
  const { inicio: inicioUtc, fin: finUtc } = limaDiaAUTC(rendicion.fecha)

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, nombre_cliente, total, cobrado_monto, cobrado_metodo, estado_pago, updated_at, clientes(nombre)')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('repartidor_id', rendicion.repartidor_id)
    .eq('estado', 'entregado')
    .gte('updated_at', inicioUtc)
    .lt('updated_at', finUtc)
    .order('updated_at', { ascending: false })

  return NextResponse.json({
    rendicion,
    pedidos: pedidos ?? [],
  })
}
