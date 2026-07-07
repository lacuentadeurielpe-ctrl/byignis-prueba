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
      .from('miembros_ferreteria')
      .select('id, nombre, email, rol, estado, local_id, created_at')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching empleados:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/equipo/empleados:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.email || !body.nombre) {
      return NextResponse.json({ error: 'Email y nombre son requeridos' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('miembros_ferreteria')
      .insert({
        ferreteria_id: session.ferreteriaId,
        nombre: body.nombre,
        email: body.email,
        rol: body.rol || 'vendedor',
        estado: 'activo',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating empleado:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'equipo',
      evento: 'empleado_agregado',
      detalle: `Empleado ${body.email} agregado`,
      usuario_id: session.userId,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/equipo/empleados:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH — asignar sucursal a un empleado (null = acceso a todas)
export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body: { id?: string; local_id?: string | null } = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })

    // Validar que el local pertenece al tenant (si no es null)
    if (body.local_id) {
      const { data: local } = await supabase
        .from('locales_ferreteria')
        .select('id')
        .eq('id', body.local_id)
        .eq('ferreteria_id', session.ferreteriaId)
        .single()
      if (!local) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('miembros_ferreteria')
      .update({ local_id: body.local_id ?? null })
      .eq('id', body.id)
      .eq('ferreteria_id', session.ferreteriaId)
      .select('id, nombre, email, rol, estado, local_id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const empleadoId = searchParams.get('id')

    if (!empleadoId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { data: empleado, error: fetchError } = await supabase
      .from('miembros_ferreteria')
      .select('email')
      .eq('id', empleadoId)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }

    const { error } = await supabase
      .from('miembros_ferreteria')
      .delete()
      .eq('id', empleadoId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting empleado:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'equipo',
      evento: 'empleado_eliminado',
      detalle: `Empleado ${empleado.email} eliminado`,
      usuario_id: session.userId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/equipo/empleados:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
