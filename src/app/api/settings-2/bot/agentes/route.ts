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
      .select('bot_agentes_activos')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching agentes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agentes: data?.bot_agentes_activos || [] })
  } catch (err) {
    console.error('Error in GET /api/settings-2/bot/agentes:', err)
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
      .update({ bot_agentes_activos: body.agentes || [] })
      .eq('id', session.ferreteriaId)
      .select('bot_agentes_activos')
      .single()

    if (error) {
      console.error('Error updating agentes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agentes: data?.bot_agentes_activos || [] })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/agentes:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
