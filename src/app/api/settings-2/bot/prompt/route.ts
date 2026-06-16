import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { PROMPT_SECTIONS, AVAILABLE_TAGS, interpolate, type InterpolateVars } from '@/lib/ai/orchestrator-prompt'
import { formatHora } from '@/lib/utils'
import type { PerfilBot, PromptOverrides, PromptSectionKey } from '@/types/database'

export const dynamic = 'force-dynamic'

const SECTION_KEYS = PROMPT_SECTIONS.map((s) => s.key)

async function cargarContexto(supabase: any, ferreteriaId: string) {
  const [{ data: ferreteria }, { data: config }] = await Promise.all([
    supabase
      .from('ferreterias')
      .select('nombre, direccion, horario_apertura, horario_cierre, dias_atencion')
      .eq('id', ferreteriaId)
      .single(),
    supabase
      .from('configuracion_bot')
      .select('perfil_bot, prompt_overrides')
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle(),
  ])

  const perfilBot: PerfilBot = config?.perfil_bot ?? {}
  const overrides: PromptOverrides = config?.prompt_overrides ?? {}

  const vars: InterpolateVars = {
    nombre_negocio: ferreteria?.nombre ?? 'tu negocio',
    tipo_negocio:   perfilBot.tipo_negocio?.trim() || 'negocio',
    nombre_bot:     perfilBot.nombre_bot?.trim() || '',
    tono:           perfilBot.tono_bot ?? 'amigable_peruano',
    horario:        ferreteria?.horario_apertura && ferreteria?.horario_cierre
      ? `${formatHora(ferreteria.horario_apertura)} a ${formatHora(ferreteria.horario_cierre)}`
      : 'consultar horario',
    dias_atencion:  ferreteria?.dias_atencion?.join(', ') ?? 'lunes a sábado',
    direccion:      ferreteria?.direccion ?? 'consultar',
  }

  return { vars, overrides }
}

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { vars, overrides } = await cargarContexto(supabase, session.ferreteriaId)

    const secciones = PROMPT_SECTIONS.map((s) => {
      const override = overrides[s.key]
      const textoBase = override ?? s.default(vars)
      return {
        key: s.key,
        label: s.label,
        avanzado: s.avanzado,
        texto: interpolate(textoBase, vars),
        esDefault: override == null,
      }
    })

    return NextResponse.json({ secciones, tags: AVAILABLE_TAGS })
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
    const key = body.key as PromptSectionKey
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

    if (error) {
      console.error('Error guardando override de prompt:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/bot/prompt:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Restablece una sección (body: { key }) o todas (body: { all: true }) a su texto predeterminado.
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (body.all === true) {
      const { error } = await supabase
        .from('configuracion_bot')
        .upsert(
          { ferreteria_id: session.ferreteriaId, prompt_overrides: {} },
          { onConflict: 'ferreteria_id' }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

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
