import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// GET /api/entregas — Entregas activas de la ferretería
export async function GET(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')

  let query = supabase
    .from('entregas')
    .select(`
      id,
      estado,
      asignado_at,
      salio_at,
      llego_at,
      distancia_km,
      duracion_estimada_min,
      duracion_real_min,
      direccion_entrega,
      instrucciones,
      gps_ultima_lat,
      gps_ultima_lng,
      gps_actualizado_at,
      pedidos(id, numero_pedido, nombre_cliente, telefono_cliente, total, estado),
      zonas_delivery(id, nombre, tiempo_estimado_min),
      repartidores(id, nombre, telefono),
      vehiculos_delivery(id, tipo, placa)
    `)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('asignado_at', { ascending: false })

  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

