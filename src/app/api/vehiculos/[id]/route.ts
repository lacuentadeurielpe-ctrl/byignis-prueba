import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'

export const dynamic = 'force-dynamic'

// PATCH /api/vehiculos/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body   = await req.json().catch(() => ({}))

  // Campos editables — no permitir cambiar ferreteria_id
  const {
    nombre, tipo, capacidad_kg, capacidad_m3,
    velocidad_promedio_kmh, costo_por_km, activo, local_id,
  } = body

  const supabase = await createClient()
  const deliveryRepo = new DeliveryRepository(supabase)

  // Sucursal base del vehículo (null = flota común, sirve a todas)
  if (local_id !== undefined && local_id !== null) {
    const { data: local } = await supabase
      .from('locales_ferreteria')
      .select('id')
      .eq('id', local_id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()
    if (!local) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  try {
    const data = await deliveryRepo.actualizarVehiculo(session.ferreteriaId, id, {
      ...(nombre                 !== undefined && { nombre: nombre.trim() }),
      ...(tipo                   !== undefined && { tipo }),
      ...(capacidad_kg           !== undefined && { capacidad_kg }),
      ...(capacidad_m3           !== undefined && { capacidad_m3 }),
      ...(velocidad_promedio_kmh !== undefined && { velocidad_promedio_kmh }),
      ...(costo_por_km           !== undefined && { costo_por_km }),
      ...(activo                 !== undefined && { activo }),
      ...(local_id               !== undefined && { local_id }),
    })

    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/vehiculos/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params

  const supabase = await createClient()
  const deliveryRepo = new DeliveryRepository(supabase)

  try {
    // Verificar que no tenga entregas activas
    const count = await deliveryRepo.contarEntregasActivasDeVehiculo(session.ferreteriaId, id)

    if (count > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar — el vehículo tiene entregas activas' },
        { status: 409 },
      )
    }

    await deliveryRepo.eliminarVehiculo(session.ferreteriaId, id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
