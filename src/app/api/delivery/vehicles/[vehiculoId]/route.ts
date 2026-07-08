/**
 * PATCH /api/delivery/vehicles/[vehiculoId]
 * Actualiza metadatos del vehículo de la flota (vehiculos_delivery).
 * Hoy: asignación de sucursal (local_id; null = flota común, sirve a todas).
 * El estado operativo se cambia en /state (workflow de averías aparte).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ vehiculoId: string }> }
) {
  const { vehiculoId } = await params

  const session = await getSessionInfo()
  if (!session?.ferreteriaId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { local_id?: string | null }
  if (body.local_id === undefined) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const supabase = await createClient()

  if (body.local_id !== null) {
    const { data: local } = await supabase
      .from('locales_ferreteria')
      .select('id')
      .eq('id', body.local_id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()
    if (!local) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('vehiculos_delivery')
    .update({ local_id: body.local_id, updated_at: new Date().toISOString() })
    .eq('id', vehiculoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .select('id, nombre, local_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })

  return NextResponse.json(data)
}
