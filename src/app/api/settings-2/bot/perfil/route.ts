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
      .select('bot_nombre, bot_instrucciones, bot_personalidad')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching bot perfil:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET /api/settings-2/bot/perfil:', err)
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
    if (body.bot_nombre !== undefined) updateData.bot_nombre = body.bot_nombre
    if (body.bot_instrucciones !== undefined) updateData.bot_instrucciones = body.bot_instrucciones
    if (body.bot_personalidad !== undefined) updateData.bot_personalidad = body.bot_personalidad

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updateData)
      .eq('id', session.ferreteriaId)
      .select('bot_nombre, bot_instrucciones, bot_personalidad')
      .single()

    if (error) {
      console.error('Error updating bot perfil:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/perfil:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
