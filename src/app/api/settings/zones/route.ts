import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SaasRepository } from '@/lib/db/repositories/saas'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'

// GET /api/settings/zones
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const saasRepo = new SaasRepository(supabase)
  const deliveryRepo = new DeliveryRepository(supabase)

  const ferreteria = await saasRepo.obtenerFerreteriaPorDuenio(user.id)
  if (!ferreteria) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  try {
    const data = await deliveryRepo.listarZonasDelivery(ferreteria.id)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/settings/zones
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const saasRepo = new SaasRepository(supabase)
  const deliveryRepo = new DeliveryRepository(supabase)

  const ferreteria = await saasRepo.obtenerFerreteriaPorDuenio(user.id)
  if (!ferreteria) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { nombre, tiempo_estimado_min } = await request.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  try {
    const data = await deliveryRepo.crearZonaDelivery(ferreteria.id, nombre.trim(), tiempo_estimado_min ?? 60)
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
