import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// PATCH /api/crm/oportunidades/[id] — actualizar oportunidad
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  try {
    const body = await request.json()

    const updates: Record<string, unknown> = {}

    if (body.titulo !== undefined) {
      const titulo = body.titulo?.trim()
      if (!titulo || titulo.length === 0) {
        return NextResponse.json({ error: 'titulo no puede estar vacío' }, { status: 400 })
      }
      updates.titulo = titulo
    }

    if (body.descripcion !== undefined) {
      updates.descripcion = body.descripcion?.trim() || null
    }

    if (body.estado !== undefined) {
      const ESTADOS_VALIDOS = ['lead', 'negociacion', 'ganado', 'perdido']
      if (!ESTADOS_VALIDOS.includes(body.estado)) {
        return NextResponse.json({ error: 'estado inválido' }, { status: 400 })
      }
      updates.estado = body.estado
    }

    if (body.valor_estimado !== undefined) {
      updates.valor_estimado = parseFloat(body.valor_estimado) || 0
    }

    if (body.probabilidad_cierre !== undefined) {
      const prob = parseInt(body.probabilidad_cierre)
      if (prob < 0 || prob > 100) {
        return NextResponse.json({ error: 'probabilidad_cierre debe estar entre 0 y 100' }, { status: 400 })
      }
      updates.probabilidad_cierre = prob
    }

    if (body.fecha_cierre_estimada !== undefined) {
      updates.fecha_cierre_estimada = body.fecha_cierre_estimada || null
    }

    if (body.vendedor_id !== undefined) {
      updates.vendedor_id = body.vendedor_id || null
    }

    if (body.cotizacion_id !== undefined) {
      updates.cotizacion_id = body.cotizacion_id || null
    }

    // Verificar que la oportunidad existe y pertenece a la ferretería
    const { data: oportunidad } = await supabase
      .from('crm_oportunidades')
      .select('id')
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!oportunidad) {
      return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('crm_oportunidades')
      .update(updates)
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .select('id, cliente_id, titulo, descripcion, estado, valor_estimado, probabilidad_cierre, fecha_cierre_estimada, vendedor_id, cotizacion_id, updated_at')
      .single()

    if (error) {
      console.error('Error updating oportunidad:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/crm/oportunidades/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/crm/oportunidades/[id] — eliminar oportunidad
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  try {
    // Verificar que la oportunidad existe y pertenece a la ferretería
    const { data: oportunidad } = await supabase
      .from('crm_oportunidades')
      .select('id')
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!oportunidad) {
      return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })
    }

    const { error } = await supabase
      .from('crm_oportunidades')
      .delete()
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting oportunidad:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(null, { status: 204 })
  } catch (err) {
    console.error('Error in DELETE /api/crm/oportunidades/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
