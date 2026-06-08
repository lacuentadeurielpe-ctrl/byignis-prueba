import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// GET /api/entregas/sin-asignar — Entregas pendientes de asignar repartidor
export async function GET(req: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('entregas')
    .select(`
      id,
      pedido_id,
      zona_delivery_id,
      estado,
      direccion_entrega,
      asignado_at,
      pedidos(numero_pedido, nombre_cliente, telefono_cliente, total),
      zonas_delivery(nombre, tiempo_estimado_min)
    `)
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('estado', 'asignado')
    .is('repartidor_id', null)
    .order('asignado_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
