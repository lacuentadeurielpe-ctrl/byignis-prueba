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
      .from('vehiculos_delivery')
      .select('id, tipo, placa, repartidor_id')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('placa', { ascending: true })

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

    if (!body.tipo || !body.placa) {
      return NextResponse.json({ error: 'Tipo y placa son requeridos' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('vehiculos_delivery')
      .insert({
        ferreteria_id: session.ferreteriaId,
        tipo: body.tipo,
        placa: body.placa.toUpperCase(),
        repartidor_id: body.repartidor_id || null,
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
      .from('vehiculos_delivery')
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
