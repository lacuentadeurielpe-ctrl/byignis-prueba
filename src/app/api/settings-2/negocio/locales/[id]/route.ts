import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { LocalFormData } from '@/types/locales'

export const dynamic = 'force-dynamic'

// PATCH /api/settings-2/negocio/locales/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    const body: Partial<LocalFormData> = await request.json()

    // Verificar que el local pertenece a la ferretería del usuario
    const { data: local, error: fetchError } = await supabase
      .from('locales_ferreteria')
      .select('ferreteria_id')
      .eq('id', id)
      .single()

    if (fetchError || local?.ferreteria_id !== session.ferreteriaId) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 })
    }

    // Si es principal, desactiva otros
    if (body.es_principal === true) {
      await supabase
        .from('locales_ferreteria')
        .update({ es_principal: false })
        .eq('ferreteria_id', session.ferreteriaId)
        .neq('id', id)
    }

    const { data, error } = await supabase
      .from('locales_ferreteria')
      .update({
        nombre: body.nombre,
        codigo: body.codigo,
        descripcion: body.descripcion,
        direccion: body.direccion,
        lat: body.lat,
        lng: body.lng,
        place_id: body.place_id,
        telefono: body.telefono,
        horario_apertura: body.horario_apertura,
        horario_cierre: body.horario_cierre,
        dias_atencion: body.dias_atencion,
        es_principal: body.es_principal,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating local:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/settings-2/negocio/locales/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    // Verificar que el local pertenece a la ferretería del usuario
    const { data: local, error: fetchError } = await supabase
      .from('locales_ferreteria')
      .select('es_principal')
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (fetchError || !local) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 })
    }

    // No permitir eliminar el local principal
    if (local.es_principal) {
      return NextResponse.json(
        { error: 'No se puede eliminar el local principal. Designa otro como principal primero.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('locales_ferreteria')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting local:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
