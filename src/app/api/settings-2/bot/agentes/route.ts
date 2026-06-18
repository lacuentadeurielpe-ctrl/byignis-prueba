import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { AGENT_REGISTRY, CORE_TOOLS } from '@/lib/ai/agents/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('ferreterias')
      .select('bot_agentes_activos, bot_herramientas_desactivadas')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching agentes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      agentes:                 data?.bot_agentes_activos ?? [],
      herramientas_desactivadas: data?.bot_herramientas_desactivadas ?? [],
      registry:                AGENT_REGISTRY,
      core_tools:              CORE_TOOLS,
    })
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
    const updates: Record<string, unknown> = {}

    if ('agentes' in body)                   updates.bot_agentes_activos = body.agentes ?? []
    if ('herramientas_desactivadas' in body) updates.bot_herramientas_desactivadas = body.herramientas_desactivadas ?? []

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updates)
      .eq('id', session.ferreteriaId)
      .select('bot_agentes_activos, bot_herramientas_desactivadas')
      .single()

    if (error) {
      console.error('Error updating agentes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      agentes:                 data?.bot_agentes_activos ?? [],
      herramientas_desactivadas: data?.bot_herramientas_desactivadas ?? [],
    })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/agentes:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
