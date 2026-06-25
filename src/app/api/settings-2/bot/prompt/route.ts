import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { PROMPT_SECTIONS, AVAILABLE_TAGS, interpolate, type InterpolateVars } from '@/lib/ai/orchestrator-prompt'
import { AGENT_REGISTRY } from '@/lib/ai/agents/registry'
import { formatHora } from '@/lib/utils'
import type { PerfilBot, PromptOverrides, PromptSectionKey } from '@/types/database'

export const dynamic = 'force-dynamic'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const SECTION_KEYS = PROMPT_SECTIONS.map((s) => s.key)

async function cargarContexto(supabase: SupabaseClient, ferreteriaId: string) {
  const [{ data: ferreteria }, { data: config }] = await Promise.all([
    supabase
      .from('ferreterias')
      .select('nombre, direccion, horario_apertura, horario_cierre, dias_atencion, bot_agentes_activos')
      .eq('id', ferreteriaId)
      .single(),
    supabase
      .from('configuracion_bot')
      .select('perfil_bot, prompt_overrides, instrucciones_agentes, instrucciones_tools')
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle(),
  ])

  const perfilBot: PerfilBot        = (config?.perfil_bot ?? {}) as PerfilBot
  const overrides: PromptOverrides  = (config?.prompt_overrides ?? {}) as PromptOverrides
  const instruccionesExtra          = String((perfilBot as Record<string, unknown>).instrucciones_extra ?? '').trim()
  const instruccionesAgentes        = (config?.instrucciones_agentes ?? {}) as Record<string, string>
  const instruccionesTools          = (config?.instrucciones_tools ?? {}) as Record<string, string>
  const agentesActivos: string[]    = ((ferreteria as Record<string, unknown>)?.bot_agentes_activos as string[]) ?? []

  const f = ferreteria as Record<string, unknown> | null
  const vars: InterpolateVars = {
    nombre_negocio: (f?.nombre as string) ?? 'tu negocio',
    tipo_negocio:   perfilBot.tipo_negocio?.trim() || 'negocio',
    nombre_bot:     perfilBot.nombre_bot?.trim() || '',
    tono:           perfilBot.tono_bot ?? 'amigable_peruano',
    horario:        f?.horario_apertura && f?.horario_cierre
      ? `${formatHora(String(f.horario_apertura))} a ${formatHora(String(f.horario_cierre))}`
      : 'consultar horario',
    dias_atencion:  Array.isArray(f?.dias_atencion)
      ? (f.dias_atencion as string[]).join(', ')
      : 'lunes a sábado',
    direccion: (f?.direccion as string) ?? 'consultar',
  }

  return { vars, overrides, instruccionesExtra, instruccionesAgentes, instruccionesTools, agentesActivos }
}

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { vars, overrides, instruccionesExtra, instruccionesAgentes, instruccionesTools, agentesActivos } =
      await cargarContexto(supabase, session.ferreteriaId)

    const secciones = PROMPT_SECTIONS.map((s) => {
      const override  = overrides[s.key]
      const textoBase = override ?? s.default(vars)
      return {
        key:       s.key,
        label:     s.label,
        avanzado:  s.avanzado,
        texto:     interpolate(textoBase, vars),
        esDefault: override == null,
      }
    })

    return NextResponse.json({
      secciones,
      tags:                  AVAILABLE_TAGS,
      instrucciones_extra:   instruccionesExtra,
      instrucciones_agentes: instruccionesAgentes,
      instrucciones_tools:   instruccionesTools,
      registry:              AGENT_REGISTRY,
      agentes_activos:       agentesActivos,
      vars,
    })
  } catch (err) {
    console.error('Error in GET /api/settings-2/bot/prompt:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    // ── Guardar instrucciones_extra (en perfil_bot) ───────────────────────────
    if ('instrucciones_extra' in body) {
      const texto = String(body.instrucciones_extra ?? '').slice(0, 2000)
      const { data: actual } = await supabase
        .from('configuracion_bot')
        .select('perfil_bot')
        .eq('ferreteria_id', session.ferreteriaId)
        .maybeSingle()
      const perfilActual = ((actual?.perfil_bot ?? {}) as Record<string, unknown>)
      const { error } = await supabase
        .from('configuracion_bot')
        .upsert(
          { ferreteria_id: session.ferreteriaId, perfil_bot: { ...perfilActual, instrucciones_extra: texto } },
          { onConflict: 'ferreteria_id' }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Guardar override de sección del prompt ────────────────────────────────
    const key   = body.key as PromptSectionKey
    const texto = body.texto as string

    if (!SECTION_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Sección de prompt inválida' }, { status: 400 })
    }
    if (typeof texto !== 'string' || texto.length > 8000) {
      return NextResponse.json({ error: 'Texto inválido (máximo 8000 caracteres)' }, { status: 400 })
    }

    const { data: actual } = await supabase
      .from('configuracion_bot')
      .select('prompt_overrides')
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle()

    const overridesNuevo: PromptOverrides = { ...(actual?.prompt_overrides ?? {}), [key]: texto }

    const { error } = await supabase
      .from('configuracion_bot')
      .upsert(
        { ferreteria_id: session.ferreteriaId, prompt_overrides: overridesNuevo },
        { onConflict: 'ferreteria_id' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/prompt:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Restablece sección(es) a predeterminados.
// body: { key } → reset una sección
// body: { all: true } → reset solo prompt_overrides
// body: { all: true, deep: true } → reset TODO (prompt_overrides + instrucciones_extra + por agente + por herramienta)
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (body.all === true) {
      const updates: Record<string, unknown> = { prompt_overrides: {} }

      if (body.deep === true) {
        // Borrar también instrucciones_extra, instrucciones_agentes, instrucciones_tools
        updates.instrucciones_agentes = {}
        updates.instrucciones_tools   = {}
        const { data: current } = await supabase
          .from('configuracion_bot')
          .select('perfil_bot')
          .eq('ferreteria_id', session.ferreteriaId)
          .maybeSingle()
        const perfilBot = { ...((current?.perfil_bot ?? {}) as Record<string, unknown>), instrucciones_extra: '' }
        updates.perfil_bot = perfilBot
      }

      const { error } = await supabase
        .from('configuracion_bot')
        .upsert(
          { ferreteria_id: session.ferreteriaId, ...updates },
          { onConflict: 'ferreteria_id' }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // Reset una sección específica
    const key = body.key as PromptSectionKey
    if (!SECTION_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Sección de prompt inválida' }, { status: 400 })
    }

    const { data: actual } = await supabase
      .from('configuracion_bot')
      .select('prompt_overrides')
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle()

    const overridesNuevo: PromptOverrides = { ...(actual?.prompt_overrides ?? {}) }
    delete overridesNuevo[key]

    const { error } = await supabase
      .from('configuracion_bot')
      .upsert(
        { ferreteria_id: session.ferreteriaId, prompt_overrides: overridesNuevo },
        { onConflict: 'ferreteria_id' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error in POST /api/settings-2/bot/prompt:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
