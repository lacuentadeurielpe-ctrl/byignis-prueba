import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import type { PerfilBot } from '@/types/database'

export const dynamic = 'force-dynamic'

const DEFAULT_PERFIL: PerfilBot = {
  nombre_bot: '',
  tono_bot: 'amigable_peruano',
  tipo_negocio: '',
  descripcion_negocio: '',
  instrucciones_extra: '',
}

// Esta ruta lee/escribe configuracion_bot.perfil_bot — es la fuente que el orquestador v2
// (flujo activo por defecto) realmente usa para armar el prompt. Antes escribía a columnas de
// ferreterias (bot_nombre/bot_personalidad/bot_instrucciones) que el orquestador v2 ignora.
export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('configuracion_bot')
      .select('perfil_bot')
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching bot perfil:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ...DEFAULT_PERFIL, ...(data?.perfil_bot ?? {}) })
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

    const { data: actual } = await supabase
      .from('configuracion_bot')
      .select('perfil_bot')
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle()

    const perfilActual: PerfilBot = actual?.perfil_bot ?? {}
    const perfilNuevo: PerfilBot = { ...perfilActual }

    if (body.nombre_bot !== undefined) perfilNuevo.nombre_bot = body.nombre_bot
    if (body.tono_bot !== undefined) perfilNuevo.tono_bot = body.tono_bot
    if (body.tipo_negocio !== undefined) perfilNuevo.tipo_negocio = body.tipo_negocio
    if (body.descripcion_negocio !== undefined) perfilNuevo.descripcion_negocio = body.descripcion_negocio
    if (body.instrucciones_extra !== undefined) perfilNuevo.instrucciones_extra = body.instrucciones_extra

    const { error } = await supabase
      .from('configuracion_bot')
      .upsert(
        { ferreteria_id: session.ferreteriaId, perfil_bot: perfilNuevo },
        { onConflict: 'ferreteria_id' }
      )

    if (error) {
      console.error('Error updating bot perfil:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ...DEFAULT_PERFIL, ...perfilNuevo })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/perfil:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
