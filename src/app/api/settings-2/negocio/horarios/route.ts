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
      .from('ferreterias')
      .select('dias_atencion, horario_apertura, horario_cierre, mensaje_bienvenida, mensaje_fuera_horario')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching horarios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET /api/settings-2/negocio/horarios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    const updateData: Record<string, any> = {}
    if (body.dias_atencion !== undefined) updateData.dias_atencion = body.dias_atencion
    if (body.horario_apertura !== undefined) updateData.horario_apertura = body.horario_apertura
    if (body.horario_cierre !== undefined) updateData.horario_cierre = body.horario_cierre
    if (body.mensaje_bienvenida !== undefined) updateData.mensaje_bienvenida = body.mensaje_bienvenida
    if (body.mensaje_fuera_horario !== undefined) updateData.mensaje_fuera_horario = body.mensaje_fuera_horario

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updateData)
      .eq('id', session.ferreteriaId)
      .select('dias_atencion, horario_apertura, horario_cierre, mensaje_bienvenida, mensaje_fuera_horario')
      .single()

    if (error) {
      console.error('Error updating horarios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/negocio/horarios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
