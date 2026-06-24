import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENT_REGISTRY, getAllToolDefs } from '@/lib/ai/agents/registry'
import type { AsistenteConfigSnapshot } from './context-builder'

export interface AnthropicTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface SsePatch {
  target: string
  key?: string
  value: unknown
}

export interface ToolResult {
  data: unknown
  patches?: SsePatch[]
  snapshotUpdate?: Partial<AsistenteConfigSnapshot>
}

const VALID_AGENT_IDS  = new Set(AGENT_REGISTRY.map(a => a.id))
const VALID_TOOL_NAMES = new Set(getAllToolDefs().map(t => t.name))

export const ASISTENTE_TOOLS: AnthropicTool[] = [
  {
    name: 'leer_config_actual',
    description: 'Lee el estado actual completo de la configuración del bot. Úsala cuando necesites ver qué agentes están activos, qué tools están desactivadas o cuáles instrucciones hay configuradas.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'editar_instrucciones_globales',
    description: 'Edita o borra las instrucciones globales extra del bot (instrucciones_extra). Estas se inyectan en TODOS los contextos del bot de WhatsApp, independiente del agente activo.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Nuevas instrucciones globales. Usa "" para borrar. Máximo 2000 caracteres.' },
      },
      required: ['texto'],
    },
  },
  {
    name: 'editar_instruccion_agente',
    description: 'Establece o borra la instrucción personalizada de un agente. Se inyecta en el prompt del bot solo cuando ese agente está activo.',
    input_schema: {
      type: 'object',
      properties: {
        agente_id: { type: 'string', description: 'ID del agente: ventas | comprobantes | upsell | crm | comunicaciones | agenda | pagos | inventario' },
        texto:     { type: 'string', description: 'Instrucción en texto libre. Usa "" para borrar. Máximo 3000 caracteres.' },
      },
      required: ['agente_id', 'texto'],
    },
  },
  {
    name: 'editar_nota_tool',
    description: 'Establece o borra la nota de comportamiento de una herramienta específica. Las notas aparecen en el prompt como "- nombre_tool: nota".',
    input_schema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string', description: 'Nombre exacto de la herramienta (ej: crear_pedido, consultar_deuda_cliente)' },
        texto:     { type: 'string', description: 'Nota de comportamiento. Usa "" para borrar. Máximo 1000 caracteres.' },
      },
      required: ['tool_name', 'texto'],
    },
  },
  {
    name: 'toggle_agente',
    description: 'Activa o desactiva un agente del bot. Los agentes desactivados no exponen sus herramientas al LLM que atiende WhatsApp.',
    input_schema: {
      type: 'object',
      properties: {
        agente_id: { type: 'string', description: 'ID del agente: ventas | comprobantes | upsell | crm | comunicaciones | agenda | pagos | inventario' },
        activo:    { type: 'boolean', description: 'true para activar, false para desactivar' },
      },
      required: ['agente_id', 'activo'],
    },
  },
  {
    name: 'toggle_tool',
    description: 'Activa o desactiva una herramienta individual. Una herramienta desactivada no está disponible aunque su agente esté activo.',
    input_schema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string', description: 'Nombre de la herramienta a activar o desactivar' },
        activo:    { type: 'boolean', description: 'true para activar, false para desactivar (añade a lista negra)' },
      },
      required: ['tool_name', 'activo'],
    },
  },
  {
    name: 'leer_logs_bot',
    description: 'Lee las últimas conversaciones del bot de WhatsApp (solo metadatos: teléfono, si está pausado, fecha último mensaje). Útil para diagnóstico.',
    input_schema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Cuántas conversaciones leer (1-20). Por defecto 5.' },
      },
    },
  },
  {
    name: 'editar_recordatorios_deuda',
    description: 'Configura el sistema de recordatorios automáticos diarios para clientes con créditos vencidos (el cron corre a las 9am Lima).',
    input_schema: {
      type: 'object',
      properties: {
        activo:         { type: 'boolean', description: 'Activar o desactivar los recordatorios automáticos' },
        dias_gracia:    { type: 'number', description: 'Días después de la fecha límite antes de enviar recordatorio (0-30)' },
        mensaje_custom: { type: 'string', description: 'Texto adicional al final del mensaje de recordatorio. "" para usar el predeterminado.' },
      },
      required: ['activo'],
    },
  },
  {
    name: 'guardar_memoria',
    description: 'Guarda una preferencia o contexto del dueño para futuras sesiones. Máximo 10 memorias de 200 chars c/u.',
    input_schema: {
      type: 'object',
      properties: {
        texto:  { type: 'string', description: 'Texto de la memoria a guardar. Máximo 200 caracteres.' },
        indice: { type: 'number', description: 'Índice a reemplazar (0-9). Omitir para agregar al final.' },
      },
      required: ['texto'],
    },
  },
  {
    name: 'borrar_memoria',
    description: 'Borra una memoria guardada del dueño por su índice (0 = la primera).',
    input_schema: {
      type: 'object',
      properties: {
        indice: { type: 'number', description: 'Índice de la memoria a borrar (0-9)' },
      },
      required: ['indice'],
    },
  },
]

// ── Entry point ───────────────────────────────────────────────────────────────

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  switch (toolName) {
    case 'leer_config_actual':       return execLeerConfig(snapshot)
    case 'editar_instrucciones_globales': return execEditarGlobales(args, supabase, ferreteriaId, snapshot)
    case 'editar_instruccion_agente':    return execEditarAgente(args, supabase, ferreteriaId, snapshot)
    case 'editar_nota_tool':             return execEditarNotaTool(args, supabase, ferreteriaId, snapshot)
    case 'toggle_agente':                return execToggleAgente(args, supabase, ferreteriaId, snapshot)
    case 'toggle_tool':                  return execToggleTool(args, supabase, ferreteriaId, snapshot)
    case 'leer_logs_bot':                return execLeerLogs(args, supabase, ferreteriaId)
    case 'editar_recordatorios_deuda':   return execEditarRecordatorios(args, supabase, ferreteriaId, snapshot)
    case 'guardar_memoria':              return execGuardarMemoria(args, supabase, ferreteriaId, snapshot)
    case 'borrar_memoria':               return execBorrarMemoria(args, supabase, ferreteriaId, snapshot)
    default: throw new Error(`Herramienta desconocida: ${toolName}`)
  }
}

// ── Executors ─────────────────────────────────────────────────────────────────

function execLeerConfig(snapshot: AsistenteConfigSnapshot): ToolResult {
  return {
    data: {
      agentes_activos:             snapshot.agentes_activos,
      herramientas_desactivadas:   snapshot.herramientas_desactivadas,
      instrucciones_extra:         snapshot.instrucciones_extra,
      instrucciones_agentes:       snapshot.instrucciones_agentes,
      instrucciones_tools:         snapshot.instrucciones_tools,
      config_recordatorios_deuda:  snapshot.config_recordatorios_deuda,
      memorias:                    snapshot.memorias,
      prompt_overrides_keys:       Object.keys(snapshot.prompt_overrides),
    },
  }
}

async function execEditarGlobales(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const texto = String(args.texto ?? '').slice(0, 2000)

  const { data: cfg } = await supabase
    .from('configuracion_bot')
    .select('perfil_bot')
    .eq('ferreteria_id', ferreteriaId)
    .maybeSingle()

  const perfilBot = { ...(cfg?.perfil_bot ?? {}) } as Record<string, unknown>
  if (texto.trim()) {
    perfilBot.instrucciones_extra = texto.trim()
  } else {
    delete perfilBot.instrucciones_extra
  }

  const { error } = await supabase
    .from('configuracion_bot')
    .upsert({ ferreteria_id: ferreteriaId, perfil_bot: perfilBot }, { onConflict: 'ferreteria_id' })

  if (error) throw new Error(error.message)

  const newValue = texto.trim()
  snapshot.instrucciones_extra = newValue

  return {
    data:            { ok: true, instrucciones_extra: newValue },
    patches:         [{ target: 'instrucciones_extra', value: newValue }],
    snapshotUpdate:  { instrucciones_extra: newValue },
  }
}

async function execEditarAgente(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const agenteId = String(args.agente_id ?? '')
  const texto    = String(args.texto ?? '').slice(0, 3000)

  if (!VALID_AGENT_IDS.has(agenteId)) {
    throw new Error(`Agente "${agenteId}" no existe. Válidos: ${[...VALID_AGENT_IDS].join(', ')}`)
  }

  const nuevas = { ...snapshot.instrucciones_agentes }
  if (texto.trim()) {
    nuevas[agenteId] = texto.trim()
  } else {
    delete nuevas[agenteId]
  }

  const { error } = await supabase
    .from('configuracion_bot')
    .upsert({ ferreteria_id: ferreteriaId, instrucciones_agentes: nuevas }, { onConflict: 'ferreteria_id' })

  if (error) throw new Error(error.message)

  snapshot.instrucciones_agentes = nuevas

  return {
    data:           { ok: true, agente: agenteId, action: texto.trim() ? 'guardada' : 'borrada' },
    patches:        [{ target: 'instrucciones_agentes', key: agenteId, value: texto.trim() || null }],
    snapshotUpdate: { instrucciones_agentes: nuevas },
  }
}

async function execEditarNotaTool(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const toolName = String(args.tool_name ?? '')
  const texto    = String(args.texto ?? '').slice(0, 1000)

  if (!VALID_TOOL_NAMES.has(toolName)) {
    throw new Error(`Herramienta "${toolName}" no existe. Revisa los nombres disponibles.`)
  }

  const nuevas = { ...snapshot.instrucciones_tools }
  if (texto.trim()) {
    nuevas[toolName] = texto.trim()
  } else {
    delete nuevas[toolName]
  }

  const { error } = await supabase
    .from('configuracion_bot')
    .upsert({ ferreteria_id: ferreteriaId, instrucciones_tools: nuevas }, { onConflict: 'ferreteria_id' })

  if (error) throw new Error(error.message)

  snapshot.instrucciones_tools = nuevas

  return {
    data:           { ok: true, tool: toolName, action: texto.trim() ? 'guardada' : 'borrada' },
    patches:        [{ target: 'instrucciones_tools', key: toolName, value: texto.trim() || null }],
    snapshotUpdate: { instrucciones_tools: nuevas },
  }
}

async function execToggleAgente(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const agenteId = String(args.agente_id ?? '')
  const activo   = Boolean(args.activo)

  if (!VALID_AGENT_IDS.has(agenteId)) {
    throw new Error(`Agente "${agenteId}" no existe.`)
  }

  let nuevosActivos = [...snapshot.agentes_activos]
  if (activo) {
    if (!nuevosActivos.includes(agenteId)) nuevosActivos.push(agenteId)
  } else {
    nuevosActivos = nuevosActivos.filter(id => id !== agenteId)
  }

  const { error } = await supabase
    .from('ferreterias')
    .update({ bot_agentes_activos: nuevosActivos })
    .eq('id', ferreteriaId)

  if (error) throw new Error(error.message)

  snapshot.agentes_activos = nuevosActivos

  return {
    data:           { ok: true, agente: agenteId, ahora: activo ? 'ACTIVO' : 'DESACTIVADO' },
    patches:        [{ target: 'agentes_activos', value: nuevosActivos }],
    snapshotUpdate: { agentes_activos: nuevosActivos },
  }
}

async function execToggleTool(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const toolName = String(args.tool_name ?? '')
  const activo   = Boolean(args.activo)

  if (!VALID_TOOL_NAMES.has(toolName)) {
    throw new Error(`Herramienta "${toolName}" no existe.`)
  }

  let nuevasDesactivadas = [...snapshot.herramientas_desactivadas]
  if (activo) {
    nuevasDesactivadas = nuevasDesactivadas.filter(t => t !== toolName)
  } else {
    if (!nuevasDesactivadas.includes(toolName)) nuevasDesactivadas.push(toolName)
  }

  const { error } = await supabase
    .from('ferreterias')
    .update({ bot_herramientas_desactivadas: nuevasDesactivadas })
    .eq('id', ferreteriaId)

  if (error) throw new Error(error.message)

  snapshot.herramientas_desactivadas = nuevasDesactivadas

  return {
    data:           { ok: true, tool: toolName, ahora: activo ? 'ACTIVA' : 'DESACTIVADA' },
    patches:        [{ target: 'herramientas_desactivadas', value: nuevasDesactivadas }],
    snapshotUpdate: { herramientas_desactivadas: nuevasDesactivadas },
  }
}

async function execLeerLogs(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string
): Promise<ToolResult> {
  const limite = Math.min(20, Math.max(1, Number(args.limite ?? 5)))

  const { data, error } = await supabase
    .from('conversaciones')
    .select('id, numero_whatsapp_cliente, bot_pausado, ultimo_mensaje_at')
    .eq('ferreteria_id', ferreteriaId)
    .order('ultimo_mensaje_at', { ascending: false })
    .limit(limite)

  if (error) throw new Error(error.message)

  return {
    data: {
      total: (data ?? []).length,
      conversaciones: (data ?? []).map(c => ({
        id:           c.id,
        telefono:     c.numero_whatsapp_cliente,
        pausado:      c.bot_pausado,
        ultimoMensaje: c.ultimo_mensaje_at,
      })),
    },
  }
}

async function execEditarRecordatorios(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const activo        = Boolean(args.activo)
  const diasGracia    = Math.max(0, Math.min(30, Number(args.dias_gracia ?? snapshot.config_recordatorios_deuda.dias_gracia)))
  const mensajeCustom = String(args.mensaje_custom ?? snapshot.config_recordatorios_deuda.mensaje_custom).slice(0, 500)

  const nueva = { activo, dias_gracia: diasGracia, mensaje_custom: mensajeCustom }

  const { error } = await supabase
    .from('configuracion_bot')
    .upsert({ ferreteria_id: ferreteriaId, config_recordatorios_deuda: nueva }, { onConflict: 'ferreteria_id' })

  if (error) throw new Error(error.message)

  snapshot.config_recordatorios_deuda = nueva

  return {
    data:           { ok: true, config: nueva },
    patches:        [{ target: 'config_recordatorios_deuda', value: nueva }],
    snapshotUpdate: { config_recordatorios_deuda: nueva },
  }
}

async function execGuardarMemoria(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const texto = String(args.texto ?? '').slice(0, 200).trim()
  if (!texto) throw new Error('El texto de la memoria no puede estar vacío')

  const nuevas = [...snapshot.memorias]
  const indice = args.indice != null ? Number(args.indice) : -1

  if (indice >= 0 && indice < 10) {
    nuevas[indice] = texto
  } else {
    if (nuevas.length >= 10) nuevas.shift()
    nuevas.push(texto)
  }

  await upsertPreferencias(supabase, ferreteriaId, { memorias: nuevas })
  snapshot.memorias = nuevas

  return {
    data:           { ok: true, memorias: nuevas },
    patches:        [{ target: 'memorias', value: nuevas }],
    snapshotUpdate: { memorias: nuevas },
  }
}

async function execBorrarMemoria(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  ferreteriaId: string,
  snapshot: AsistenteConfigSnapshot
): Promise<ToolResult> {
  const indice = Number(args.indice ?? -1)
  if (indice < 0 || indice >= snapshot.memorias.length) {
    throw new Error(`Índice ${indice} fuera de rango (hay ${snapshot.memorias.length} memorias, índices 0-${snapshot.memorias.length - 1})`)
  }

  const nuevas = [...snapshot.memorias]
  nuevas.splice(indice, 1)

  await upsertPreferencias(supabase, ferreteriaId, { memorias: nuevas })
  snapshot.memorias = nuevas

  return {
    data:           { ok: true, memorias: nuevas },
    patches:        [{ target: 'memorias', value: nuevas }],
    snapshotUpdate: { memorias: nuevas },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertPreferencias(
  supabase: SupabaseClient,
  ferreteriaId: string,
  update: { memorias?: string[]; auditoria?: unknown[] }
) {
  const { data: cur } = await supabase
    .from('configuracion_bot')
    .select('asistente_preferencias')
    .eq('ferreteria_id', ferreteriaId)
    .maybeSingle()

  const merged = {
    ...(cur?.asistente_preferencias ?? { memorias: [], auditoria: [] }),
    ...update,
  }

  const { error } = await supabase
    .from('configuracion_bot')
    .upsert({ ferreteria_id: ferreteriaId, asistente_preferencias: merged }, { onConflict: 'ferreteria_id' })

  if (error) throw new Error(error.message)
}
