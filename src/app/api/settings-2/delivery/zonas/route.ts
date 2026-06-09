import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// La tabla zonas_delivery usa: tiempo_estimado_min, costo_base, radio_km
// La UI/API pública usa:       eta_minutos,         costo_delivery, radio_km
// Estas funciones mapean entre ambos mundos.
function dbToApi(zona: any) {
  return {
    id:             zona.id,
    nombre:         zona.nombre,
    radio_km:       zona.radio_km ?? 5,
    eta_minutos:    zona.tiempo_estimado_min ?? 30,
    costo_delivery: zona.costo_base ?? 0,
    activo:         zona.activo ?? true,
    descripcion:    zona.descripcion ?? null,
  }
}

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('zonas_delivery')
      .select('id, nombre, radio_km, tiempo_estimado_min, costo_base, activo, descripcion')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error fetching zonas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data ?? []).map(dbToApi))
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
        ferreteria_id:        session.ferreteriaId,
        nombre:               body.nombre,
        radio_km:             body.radio_km ?? 5,
        tiempo_estimado_min:  body.eta_minutos ?? 30,
        costo_base:           body.costo_delivery ?? 0,
        activo:               true,
        descripcion:          body.descripcion ?? null,
      })
      .select('id, nombre, radio_km, tiempo_estimado_min, costo_base, activo, descripcion')
      .single()

    if (error) {
      console.error('Error creating zona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(dbToApi(data))
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
    if (body.nombre            !== undefined) updateData.nombre               = body.nombre
    if (body.radio_km          !== undefined) updateData.radio_km             = body.radio_km
    if (body.eta_minutos       !== undefined) updateData.tiempo_estimado_min  = body.eta_minutos
    if (body.costo_delivery    !== undefined) updateData.costo_base           = body.costo_delivery
    if (body.activo            !== undefined) updateData.activo               = body.activo
    if (body.descripcion       !== undefined) updateData.descripcion          = body.descripcion

    const { data, error } = await supabase
      .from('zonas_delivery')
      .update(updateData)
      .eq('id', body.id)
      .eq('ferreteria_id', session.ferreteriaId)
      .select('id, nombre, radio_km, tiempo_estimado_min, costo_base, activo, descripcion')
      .single()

    if (error) {
      console.error('Error updating zona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(dbToApi(data))
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
