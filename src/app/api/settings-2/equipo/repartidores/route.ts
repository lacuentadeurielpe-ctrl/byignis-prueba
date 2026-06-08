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
      .from('repartidores')
      .select('id, nombre, telefono, pin, estado, zonas_asignadas, created_at')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching repartidores:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/equipo/repartidores:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.nombre || !body.telefono) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos' }, { status: 400 })
    }

    const pin = Math.floor(1000 + Math.random() * 9000).toString()

    const { data, error } = await supabase
      .from('repartidores')
      .insert({
        ferreteria_id: session.ferreteriaId,
        nombre: body.nombre,
        telefono: body.telefono,
        pin,
        estado: 'activo',
        zonas_asignadas: body.zonas_asignadas || [],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating repartidor:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'equipo',
      evento: 'repartidor_agregado',
      detalle: `Repartidor ${body.nombre} agregado con PIN ${pin}`,
      usuario_id: session.userId,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/equipo/repartidores:', err)
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
    if (body.telefono !== undefined) updateData.telefono = body.telefono
    if (body.estado !== undefined) updateData.estado = body.estado
    if (body.zonas_asignadas !== undefined) updateData.zonas_asignadas = body.zonas_asignadas

    const { data, error } = await supabase
      .from('repartidores')
      .update(updateData)
      .eq('id', body.id)
      .eq('ferreteria_id', session.ferreteriaId)
      .select()
      .single()

    if (error) {
      console.error('Error updating repartidor:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/equipo/repartidores:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const repartidorId = searchParams.get('id')

    if (!repartidorId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { data: repartidor } = await supabase
      .from('repartidores')
      .select('nombre')
      .eq('id', repartidorId)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    const { error } = await supabase
      .from('repartidores')
      .delete()
      .eq('id', repartidorId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting repartidor:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'equipo',
      evento: 'repartidor_eliminado',
      detalle: `Repartidor ${repartidor?.nombre} eliminado`,
      usuario_id: session.userId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/equipo/repartidores:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
