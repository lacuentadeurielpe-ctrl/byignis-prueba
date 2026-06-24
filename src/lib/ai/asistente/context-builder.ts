import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENT_REGISTRY, CORE_TOOLS } from '@/lib/ai/agents/registry'
import { PROMPT_SECTIONS } from '@/lib/ai/orchestrator-prompt'

export interface AsistenteConfigSnapshot {
  agentes_activos:             string[]
  herramientas_desactivadas:   string[]
  instrucciones_agentes:       Record<string, string>
  instrucciones_tools:         Record<string, string>
  prompt_overrides:            Record<string, string>
  instrucciones_extra:         string
  config_recordatorios_deuda:  { activo: boolean; dias_gracia: number; mensaje_custom: string }
  memorias:                    string[]
  fetchedAt:                   number
}

export async function loadConfigSnapshot(
  supabase: SupabaseClient,
  ferreteriaId: string
): Promise<AsistenteConfigSnapshot> {
  const [{ data: ferreteria }, { data: config }] = await Promise.all([
    supabase
      .from('ferreterias')
      .select('bot_agentes_activos, bot_herramientas_desactivadas')
      .eq('id', ferreteriaId)
      .single(),
    supabase
      .from('configuracion_bot')
      .select('instrucciones_agentes, instrucciones_tools, prompt_overrides, perfil_bot, config_recordatorios_deuda, asistente_preferencias')
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle(),
  ])

  const perfilBot  = (config?.perfil_bot ?? {}) as Record<string, unknown>
  const prefs      = (config?.asistente_preferencias ?? { memorias: [], auditoria: [] }) as { memorias: string[]; auditoria: unknown[] }

  return {
    agentes_activos:           ferreteria?.bot_agentes_activos ?? ['ventas', 'comprobantes', 'upsell', 'crm', 'comunicaciones', 'agenda', 'pagos', 'inventario'],
    herramientas_desactivadas: ferreteria?.bot_herramientas_desactivadas ?? [],
    instrucciones_agentes:     (config?.instrucciones_agentes ?? {}) as Record<string, string>,
    instrucciones_tools:       (config?.instrucciones_tools ?? {}) as Record<string, string>,
    prompt_overrides:          (config?.prompt_overrides ?? {}) as Record<string, string>,
    instrucciones_extra:       String(perfilBot.instrucciones_extra ?? '').trim(),
    config_recordatorios_deuda: config?.config_recordatorios_deuda ?? { activo: false, dias_gracia: 1, mensaje_custom: '' },
    memorias:                  prefs.memorias ?? [],
    fetchedAt:                 Date.now(),
  }
}

export function buildAsistenteSystemPrompt(snapshot: AsistenteConfigSnapshot): string {
  const agentesActivos = new Set(snapshot.agentes_activos)
  const desactivadas   = new Set(snapshot.herramientas_desactivadas)

  const agentesDesc = AGENT_REGISTRY.map(agent => {
    const activo      = agentesActivos.has(agent.id)
    const instruccion = snapshot.instrucciones_agentes[agent.id]
    const instrStr    = instruccion
      ? `\n  ↳ Instrucción actual: "${instruccion.slice(0, 150)}${instruccion.length > 150 ? '...' : ''}"`
      : ''

    const toolsDesc = agent.tools.map(t => {
      const off    = desactivadas.has(t.name)
      const integr = t.requiereIntegracion ? ` [req: ${t.requiereIntegracion}]` : ''
      const nota   = snapshot.instrucciones_tools[t.name]
      const notaStr = nota ? ` | nota: "${nota.slice(0, 70)}${nota.length > 70 ? '...' : ''}"` : ''
      return `    • ${t.name}${off ? ' [DESACTIVADA]' : ''}${integr}${notaStr}`
    }).join('\n')

    return `**${agent.label}** (id: "${agent.id}") — ${activo ? '✅ ACTIVO' : '❌ DESACTIVADO'}
  ${agent.desc}${instrStr}
  Herramientas:
${toolsDesc}`
  }).join('\n\n')

  const coreDesc = CORE_TOOLS.map(t => `  • ${t.name}: ${t.desc}`).join('\n')

  const promptDesc = PROMPT_SECTIONS
    .filter(s => s.key !== 'verificacion_pagos')
    .map(s => {
      const override = snapshot.prompt_overrides[s.key]
      const estado   = override ? `PERSONALIZADA (${override.length} chars)` : 'predeterminada'
      return `  • "${s.key}" (${s.label}): ${estado}`
    }).join('\n')

  const memoriasBlock = snapshot.memorias.length > 0
    ? `\n## Memorias guardadas del dueño\n${snapshot.memorias.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n`
    : ''

  const rec = snapshot.config_recordatorios_deuda
  const configLines = [
    `Recordatorios de deuda: ${rec.activo ? `ACTIVOS (${rec.dias_gracia} días gracia)` : 'desactivados'}`,
    snapshot.herramientas_desactivadas.length > 0
      ? `Tools globalmente desactivadas: ${snapshot.herramientas_desactivadas.join(', ')}`
      : null,
    `Instrucciones globales extra: ${snapshot.instrucciones_extra ? `"${snapshot.instrucciones_extra.slice(0, 200)}${snapshot.instrucciones_extra.length > 200 ? '...' : ''}"` : '(vacías)'}`,
  ].filter(Boolean).join('\n')

  return `Eres el Asistente IA nativo de FerroBot. Tu función es ayudar al dueño de la ferretería a configurar y optimizar su bot de WhatsApp de forma conversacional e inteligente.

# SANDBOX — LO QUE PUEDES Y NO PUEDES

## ✅ Tu dominio (tienes 10 herramientas):
- Editar instrucciones globales del bot (editar_instrucciones_globales)
- Editar instrucciones por agente (editar_instruccion_agente)
- Editar notas por herramienta (editar_nota_tool)
- Activar / desactivar agentes (toggle_agente)
- Activar / desactivar herramientas individuales (toggle_tool)
- Leer logs recientes del bot (leer_logs_bot)
- Configurar recordatorios de deuda (editar_recordatorios_deuda)
- Guardar / borrar memorias del dueño (guardar_memoria, borrar_memoria)

## 🚫 Fuera de tu alcance:
- Código fuente, pedidos, clientes, productos, inventario
- Facturación, suscripción, datos de otras ferreterías
- SQL directo, APIs externas

Cuando el dueño pida algo fuera de tu sandbox, explícalo amablemente.

# ARQUITECTURA COMPLETA DEL BOT

## Sistema de prompts — 3 capas (general → específica)

**Capa 1 — Global** (editar con: editar_instrucciones_globales):
Inyectadas en TODOS los contextos. Son las más amplias.
Estado: ${snapshot.instrucciones_extra ? `"${snapshot.instrucciones_extra.slice(0, 200)}"` : '(vacías)'}

**Capa 2 — Por agente** (editar con: editar_instruccion_agente):
Inyectadas solo cuando ese agente está activo. Max 3000 chars.

**Capa 3 — Por herramienta** (editar con: editar_nota_tool):
Notas específicas de comportamiento por tool. Max 1000 chars. Aparecen como "- tool_name: nota" en el prompt.

## Herramientas núcleo (siempre activas, no se pueden apagar)
${coreDesc}

## Agentes configurables (8 agentes)
${agentesDesc}

## Secciones del prompt del orquestador (editables en Settings → Bot → Prompt del dashboard)
${promptDesc}

## Configuración actual
${configLines}
${memoriasBlock}
# CÓMO TRABAJAR

1. **Ejecuta directamente** cuando el dueño pide un cambio claro — no pidas confirmación a menos que haya un conflicto real.
2. Tras cada cambio, confirma brevemente qué hiciste y su efecto esperado.
3. Si detectas un **conflicto** (apagar pagos con recordatorios activos, etc.), advierte ANTES de ejecutar.
4. Habla en español peruano, claro y directo. Sin jerga técnica salvo que el dueño la use.
5. Para ver el estado actual antes de cambios, usa leer_config_actual.
6. Para cambios masivos (reestructurar todo el sistema de prompts), comparte el plan antes de ejecutar múltiples herramientas.

Responde siempre en español.`
}
