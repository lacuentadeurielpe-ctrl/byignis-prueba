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
      .select('bot_margen_minimo, bot_debounce_ms, bot_grace_period_min, bot_autoclose_cotizacion')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching comportamiento:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET /api/settings-2/bot/comportamiento:', err)
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
    if (body.bot_margen_minimo !== undefined) updateData.bot_margen_minimo = body.bot_margen_minimo
    if (body.bot_debounce_ms !== undefined) updateData.bot_debounce_ms = body.bot_debounce_ms
    if (body.bot_grace_period_min !== undefined) updateData.bot_grace_period_min = body.bot_grace_period_min
    if (body.bot_autoclose_cotizacion !== undefined) updateData.bot_autoclose_cotizacion = body.bot_autoclose_cotizacion

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updateData)
      .eq('id', session.ferreteriaId)
      .select('bot_margen_minimo, bot_debounce_ms, bot_grace_period_min, bot_autoclose_cotizacion')
      .single()

    if (error) {
      console.error('Error updating comportamiento:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/comportamiento:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
