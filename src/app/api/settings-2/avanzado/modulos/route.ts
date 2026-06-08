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
      .select('modulos_activos')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching modulos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ modulos: data?.modulos_activos || [] })
  } catch (err) {
    console.error('Error in GET /api/settings-2/avanzado/modulos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('ferreterias')
      .update({ modulos_activos: body.modulos || [] })
      .eq('id', session.ferreteriaId)
      .select('modulos_activos')
      .single()

    if (error) {
      console.error('Error updating modulos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id: session.ferreteriaId,
      integracion_tipo: 'avanzado',
      evento: 'modulos_actualizados',
      detalle: `Módulos: ${body.modulos?.join(', ')}`,
      usuario_id: session.userId,
    })

    return NextResponse.json({ modulos: data?.modulos_activos || [] })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/avanzado/modulos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
