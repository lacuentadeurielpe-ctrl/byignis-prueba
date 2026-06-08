import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

interface AsignarRequest {
  repartidor_id: string
  vehiculo_id?: string
}

// PATCH /api/entregas/[id]/asignar — Asignar entrega a repartidor
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params
  const body: AsignarRequest = await request.json()

  if (!body.repartidor_id) {
    return NextResponse.json({ error: 'repartidor_id es requerido' }, { status: 400 })
  }

  // 1. Verificar que entrega pertenece a la ferretería del usuario
  const { data: entrega, error: errEntrega } = await supabase
    .from('entregas')
    .select('id, ferreteria_id, estado')
    .eq('id', id)
    .single()

  if (errEntrega || !entrega) {
    return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
  }

  if (entrega.ferreteria_id !== session.ferreteriaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // 2. Verificar que repartidor existe y pertenece a la ferretería
  const { data: repartidor, error: errRepartidor } = await supabase
    .from('repartidores')
    .select('id')
    .eq('id', body.repartidor_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errRepartidor || !repartidor) {
    return NextResponse.json({ error: 'Repartidor no encontrado' }, { status: 404 })
  }

  // 3. Si hay vehículo, verificar que pertenece a la ferretería
  if (body.vehiculo_id) {
    const { data: vehiculo, error: errVehiculo } = await supabase
      .from('vehiculos_delivery')
      .select('id')
      .eq('id', body.vehiculo_id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (errVehiculo || !vehiculo) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
    }
  }

  // 4. Actualizar entrega
  const { data, error } = await supabase
    .from('entregas')
    .update({
      repartidor_id: body.repartidor_id,
      vehiculo_id: body.vehiculo_id || null,
      estado: 'asignado'
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    entrega: data,
    message: 'Entrega asignada correctamente'
  })
}
