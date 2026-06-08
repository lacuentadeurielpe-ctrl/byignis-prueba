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
      .from('zonas_delivery')
      .select('id, nombre, radio_km, eta_minutos, costo_delivery')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error fetching zonas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/delivery/zonas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.nombre) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('zonas_delivery')
      .insert({
        ferreteria_id: session.ferreteriaId,
        nombre: body.nombre,
        radio_km: body.radio_km || 5,
        eta_minutos: body.eta_minutos || 30,
        costo_delivery: body.costo_delivery || 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating zona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/delivery/zonas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const updateData: Record<string, any> = {}
    if (body.nombre !== undefined) updateData.nombre = body.nombre
    if (body.radio_km !== undefined) updateData.radio_km = body.radio_km
    if (body.eta_minutos !== undefined) updateData.eta_minutos = body.eta_minutos
    if (body.costo_delivery !== undefined) updateData.costo_delivery = body.costo_delivery

    const { data, error } = await supabase
      .from('zonas_delivery')
      .update(updateData)
      .eq('id', body.id)
      .eq('ferreteria_id', session.ferreteriaId)
      .select()
      .single()

    if (error) {
      console.error('Error updating zona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/delivery/zonas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const zonaId = searchParams.get('id')

    if (!zonaId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('zonas_delivery')
      .delete()
      .eq('id', zonaId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting zona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/delivery/zonas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
