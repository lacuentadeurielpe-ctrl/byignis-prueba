import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// Combina dos tablas porque el bot las lee de fuentes distintas (ver message-handler.ts):
// - ferreterias: bot_debounce_ms, bot_margen_minimo (= umbral de upsell real), bot_autoclose_cotizacion,
//   bot_delay_respuesta_ms, timeout_intervencion_dueno (todas tienen precedencia sobre configuracion_bot)
// - configuracion_bot: timeout_sesion_minutos, max_mensajes_contexto, umbral_monto_negociacion
//   (no tienen columna espejo en ferreterias, solo viven aquí)
const DEFAULTS = {
  bot_margen_minimo: 0,
  bot_debounce_ms: 8000,
  bot_delay_respuesta_ms: 0,
  bot_autoclose_cotizacion: false,
  timeout_intervencion_dueno: 30,
  timeout_sesion_minutos: 60,
  max_mensajes_contexto: 10,
  umbral_monto_negociacion: null as number | null,
}

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const [{ data: ferreteria, error: errF }, { data: config, error: errC }] = await Promise.all([
      supabase
        .from('ferreterias')
        .select('bot_margen_minimo, bot_debounce_ms, bot_delay_respuesta_ms, bot_autoclose_cotizacion, timeout_intervencion_dueno')
        .eq('id', session.ferreteriaId)
        .single(),
      supabase
        .from('configuracion_bot')
        .select('timeout_sesion_minutos, max_mensajes_contexto, umbral_monto_negociacion')
        .eq('ferreteria_id', session.ferreteriaId)
        .maybeSingle(),
    ])

    if (errF) {
      console.error('Error fetching comportamiento (ferreterias):', errF)
      return NextResponse.json({ error: errF.message }, { status: 500 })
    }
    if (errC) {
      console.error('Error fetching comportamiento (configuracion_bot):', errC)
      return NextResponse.json({ error: errC.message }, { status: 500 })
    }

    return NextResponse.json({ ...DEFAULTS, ...ferreteria, ...(config ?? {}) })
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

    const updateFerreteria: Record<string, any> = {}
    if (body.bot_margen_minimo !== undefined) updateFerreteria.bot_margen_minimo = body.bot_margen_minimo
    if (body.bot_debounce_ms !== undefined) updateFerreteria.bot_debounce_ms = body.bot_debounce_ms
    if (body.bot_delay_respuesta_ms !== undefined) updateFerreteria.bot_delay_respuesta_ms = body.bot_delay_respuesta_ms
    if (body.bot_autoclose_cotizacion !== undefined) updateFerreteria.bot_autoclose_cotizacion = body.bot_autoclose_cotizacion
    if (body.timeout_intervencion_dueno !== undefined) updateFerreteria.timeout_intervencion_dueno = body.timeout_intervencion_dueno

    const updateConfig: Record<string, any> = {}
    if (body.timeout_sesion_minutos !== undefined) updateConfig.timeout_sesion_minutos = body.timeout_sesion_minutos
    if (body.max_mensajes_contexto !== undefined) updateConfig.max_mensajes_contexto = body.max_mensajes_contexto
    if (body.umbral_monto_negociacion !== undefined) updateConfig.umbral_monto_negociacion = body.umbral_monto_negociacion

    const ops: any[] = []

    if (Object.keys(updateFerreteria).length > 0) {
      ops.push(
        supabase.from('ferreterias').update(updateFerreteria).eq('id', session.ferreteriaId)
      )
    }
    if (Object.keys(updateConfig).length > 0) {
      ops.push(
        supabase.from('configuracion_bot').upsert(
          { ferreteria_id: session.ferreteriaId, ...updateConfig },
          { onConflict: 'ferreteria_id' }
        )
      )
    }

    const results = await Promise.all(ops)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.error('Error updating comportamiento:', failed.error)
      return NextResponse.json({ error: failed.error.message }, { status: 500 })
    }

    const [{ data: ferreteria }, { data: config }] = await Promise.all([
      supabase
        .from('ferreterias')
        .select('bot_margen_minimo, bot_debounce_ms, bot_delay_respuesta_ms, bot_autoclose_cotizacion, timeout_intervencion_dueno')
        .eq('id', session.ferreteriaId)
        .single(),
      supabase
        .from('configuracion_bot')
        .select('timeout_sesion_minutos, max_mensajes_contexto, umbral_monto_negociacion')
        .eq('ferreteria_id', session.ferreteriaId)
        .maybeSingle(),
    ])

    return NextResponse.json({ ...DEFAULTS, ...ferreteria, ...(config ?? {}) })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/comportamiento:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
