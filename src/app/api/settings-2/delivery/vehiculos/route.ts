import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('id, nombre, tipo, placa, velocidad_promedio_kmh, capacidad_kg, capacidad_m3, costo_por_km, activo')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error fetching vehiculos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/delivery/vehiculos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.tipo) {
      return NextResponse.json({ error: 'Tipo es requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('vehiculos')
      .insert({
        ferreteria_id: session.ferreteriaId,
        nombre: body.nombre || body.tipo,
        tipo: body.tipo,
        placa: body.placa?.toUpperCase() || null,
        velocidad_promedio_kmh: body.velocidad_promedio_kmh ?? 30,
        capacidad_kg: body.capacidad_kg ?? 50,
        capacidad_m3: body.capacidad_m3 ?? null,
        costo_por_km: body.costo_por_km ?? null,
        activo: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating vehiculo:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/delivery/vehiculos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const vehiculoId = searchParams.get('id')
    if (!vehiculoId) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })

    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if (body.nombre !== undefined) updates.nombre = body.nombre
    if (body.tipo !== undefined) updates.tipo = body.tipo
    if (body.placa !== undefined) updates.placa = body.placa?.toUpperCase() || null
    if (body.velocidad_promedio_kmh !== undefined) updates.velocidad_promedio_kmh = body.velocidad_promedio_kmh
    if (body.capacidad_kg !== undefined) updates.capacidad_kg = body.capacidad_kg
    if (body.activo !== undefined) updates.activo = body.activo

    const { data, error } = await supabase
      .from('vehiculos')
      .update(updates)
      .eq('id', vehiculoId)
      .eq('ferreteria_id', session.ferreteriaId)
      .select()
      .single()

    if (error) {
      console.error('Error updating vehiculo:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/delivery/vehiculos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const vehiculoId = searchParams.get('id')

    if (!vehiculoId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('vehiculos')
      .delete()
      .eq('id', vehiculoId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting vehiculo:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/delivery/vehiculos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
