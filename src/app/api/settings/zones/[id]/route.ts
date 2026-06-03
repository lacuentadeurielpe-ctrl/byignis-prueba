import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SaasRepository } from '@/lib/db/repositories/saas'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'

// PATCH /api/settings/zones/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const saasRepo = new SaasRepository(supabase)
  const deliveryRepo = new DeliveryRepository(supabase)

  const ferreteria = await saasRepo.obtenerFerreteriaPorDuenio(user.id)
  if (!ferreteria) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (body.nombre !== undefined) update.nombre = body.nombre
  if (body.tiempo_estimado_min !== undefined) update.tiempo_estimado_min = body.tiempo_estimado_min

  try {
    const data = await deliveryRepo.actualizarZonaDelivery(ferreteria.id, id, update)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/settings/zones/[id]
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const saasRepo = new SaasRepository(supabase)
  const deliveryRepo = new DeliveryRepository(supabase)

  const ferreteria = await saasRepo.obtenerFerreteriaPorDuenio(user.id)
  if (!ferreteria) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  try {
    await deliveryRepo.eliminarZonaDelivery(ferreteria.id, id)
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
