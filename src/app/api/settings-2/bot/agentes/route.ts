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
    const [{ data: ferreteria, error: errF }, { data: config, error: errC }] = await Promise.all([
      supabase
        .from('ferreterias')
        .select('bot_agentes_activos, bot_herramientas_desactivadas')
        .eq('id', session.ferreteriaId)
        .single(),
      supabase
        .from('configuracion_bot')
        .select('instrucciones_agentes, instrucciones_tools, config_recordatorios_deuda')
        .eq('ferreteria_id', session.ferreteriaId)
        .maybeSingle(),
    ])

    if (errF) {
      console.error('Error fetching agentes:', errF)
      return NextResponse.json({ error: errF.message }, { status: 500 })
    }

    return NextResponse.json({
      agentes:                    ferreteria?.bot_agentes_activos ?? [],
      herramientas_desactivadas:  ferreteria?.bot_herramientas_desactivadas ?? [],
      instrucciones_agentes:      (config?.instrucciones_agentes ?? {}) as Record<string, string>,
      instrucciones_tools:        (config?.instrucciones_tools ?? {}) as Record<string, string>,
      config_recordatorios_deuda: config?.config_recordatorios_deuda ?? { activo: false, dias_gracia: 1, mensaje_custom: '' },
      registry:                   AGENT_REGISTRY,
      core_tools:                 CORE_TOOLS,
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

    // ── Guardar instrucción de un agente específico ──────────────────────────
    // Body: { instruccion_agente: { id: string, texto: string } }
    if ('instruccion_agente' in body) {
      const { id, texto } = body.instruccion_agente as { id: string; texto: string }

      if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'id de agente inválido' }, { status: 400 })
      }
      if (typeof texto !== 'string' || texto.length > 3000) {
        return NextResponse.json({ error: 'Texto inválido (máximo 3000 caracteres)' }, { status: 400 })
      }

      const { data: actual } = await supabase
        .from('configuracion_bot')
        .select('instrucciones_agentes')
        .eq('ferreteria_id', session.ferreteriaId)
        .maybeSingle()

      const instruccionesActuales: Record<string, string> = (actual?.instrucciones_agentes ?? {}) as Record<string, string>
      const instruccionesNuevas = { ...instruccionesActuales }
      if (texto.trim() === '') {
        delete instruccionesNuevas[id]
      } else {
        instruccionesNuevas[id] = texto.trim()
      }

      const { error } = await supabase
        .from('configuracion_bot')
        .upsert(
          { ferreteria_id: session.ferreteriaId, instrucciones_agentes: instruccionesNuevas },
          { onConflict: 'ferreteria_id' }
        )

      if (error) {
        console.error('Error guardando instrucción de agente:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, instrucciones_agentes: instruccionesNuevas })
    }

    // ── Guardar nota de una herramienta específica ────────────────────────────
    // Body: { instruccion_tool: { name: string, texto: string } }
    if ('instruccion_tool' in body) {
      const { name, texto } = body.instruccion_tool as { name: string; texto: string }

      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'nombre de tool inválido' }, { status: 400 })
      }
      if (typeof texto !== 'string' || texto.length > 1000) {
        return NextResponse.json({ error: 'Texto inválido (máximo 1000 caracteres)' }, { status: 400 })
      }

      const { data: actual } = await supabase
        .from('configuracion_bot')
        .select('instrucciones_tools')
        .eq('ferreteria_id', session.ferreteriaId)
        .maybeSingle()

      const toolsActuales: Record<string, string> = (actual?.instrucciones_tools ?? {}) as Record<string, string>
      const toolsNuevas = { ...toolsActuales }
      if (texto.trim() === '') {
        delete toolsNuevas[name]
      } else {
        toolsNuevas[name] = texto.trim()
      }

      const { error } = await supabase
        .from('configuracion_bot')
        .upsert(
          { ferreteria_id: session.ferreteriaId, instrucciones_tools: toolsNuevas },
          { onConflict: 'ferreteria_id' }
        )

      if (error) {
        console.error('Error guardando nota de tool:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, instrucciones_tools: toolsNuevas })
    }

    // ── Guardar config de recordatorios de deuda ─────────────────────────────
    // Body: { config_recordatorios_deuda: { activo, dias_gracia, mensaje_custom } }
    if ('config_recordatorios_deuda' in body) {
      const cfg = body.config_recordatorios_deuda as {
        activo?: boolean
        dias_gracia?: number
        mensaje_custom?: string
      }

      const dias = Math.max(0, Math.min(30, Number(cfg.dias_gracia ?? 1)))
      const configLimpia = {
        activo:         !!cfg.activo,
        dias_gracia:    dias,
        mensaje_custom: (cfg.mensaje_custom ?? '').slice(0, 500),
      }

      const { error } = await supabase
        .from('configuracion_bot')
        .upsert(
          { ferreteria_id: session.ferreteriaId, config_recordatorios_deuda: configLimpia },
          { onConflict: 'ferreteria_id' }
        )

      if (error) {
        console.error('Error guardando config_recordatorios_deuda:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, config_recordatorios_deuda: configLimpia })
    }

    // ── Guardar toggles de agentes y herramientas (comportamiento original) ──
    const updates: Record<string, unknown> = {}
    if ('agentes' in body)                   updates.bot_agentes_activos          = body.agentes ?? []
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
      agentes:                   data?.bot_agentes_activos ?? [],
      herramientas_desactivadas: data?.bot_herramientas_desactivadas ?? [],
    })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/agentes:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
