// Registro central de agentes y herramientas del orquestador.
// Es la única fuente de verdad: UI, orquestador, integraciones y prompt leen de aquí.

export type IntegracionTipo =
  | 'gmail'
  | 'telegram'
  | 'drive'
  | 'calendar'
  | 'nubefact'
  | 'mercadopago'

export interface ToolDef {
  name: string                            // coincide con TOOL_SCHEMAS + TOOL_EXECUTORS
  label: string                           // UI
  desc: string                            // UI — descripción corta
  nucleo?: boolean                        // siempre ON, no se puede apagar (solo para tools núcleo)
  requiereIntegracion?: IntegracionTipo   // si no está conectada → tool invisible al LLM
}

export interface AgentDef {
  id: string      // 'ventas' | 'comprobantes' | 'upsell' | 'crm'
  label: string
  desc: string
  accent: string  // color hex para el acordeón en UI
  tools: ToolDef[]
}

// ── Tools núcleo (siempre activas, no controladas por ningún agente) ──────────

export const CORE_TOOLS: ToolDef[] = [
  { name: 'buscar_producto',  label: 'Buscar producto',  desc: 'Busca productos por nombre en el catálogo', nucleo: true },
  { name: 'obtener_stock',    label: 'Consultar stock',   desc: 'Nivel de stock actual de un producto',      nucleo: true },
  { name: 'consultar_pedido', label: 'Consultar pedido',  desc: 'Estado de un pedido del cliente',           nucleo: true },
  { name: 'info_ferreteria',  label: 'Info del negocio',  desc: 'Horarios, dirección, métodos de pago',      nucleo: true },
  { name: 'escalar_humano',   label: 'Escalar a humano',  desc: 'Pausa el bot para atención manual',         nucleo: true },
]

export const CORE_TOOL_NAMES = new Set(CORE_TOOLS.map((t) => t.name))

// ── Registro de agentes configurables ─────────────────────────────────────────

export const AGENT_REGISTRY: AgentDef[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    desc: 'Cotizaciones, pedidos y modificaciones',
    accent: '#22c55e',
    tools: [
      { name: 'guardar_cotizacion',          label: 'Guardar cotización',      desc: 'Crea el registro de cotización en BD' },
      { name: 'generar_cotizacion_pdf',      label: 'PDF de cotización',       desc: 'Genera y envía por WhatsApp el PDF de la cotización activa' },
      { name: 'crear_pedido',                label: 'Crear pedido',            desc: 'Confirma y crea el pedido definitivo' },
      { name: 'agregar_a_pedido_reciente',   label: 'Agregar al pedido',       desc: 'Agrega productos al pedido más reciente (ventana de gracia)' },
      { name: 'modificar_pedido',            label: 'Modificar pedido',        desc: 'Cambia cantidades o elimina productos de un pedido pendiente' },
    ],
  },
  {
    id: 'comprobantes',
    label: 'Comprobantes',
    desc: 'Boletas, facturas, notas de venta y proformas',
    accent: '#3b82f6',
    tools: [
      { name: 'solicitar_comprobante', label: 'Emitir comprobante', desc: 'Genera y envía el comprobante por WhatsApp' },
    ],
  },
  {
    id: 'upsell',
    label: 'Upsell',
    desc: 'Sugerencias de productos complementarios',
    accent: '#f59e0b',
    tools: [
      { name: 'sugerir_complementario', label: 'Sugerir complementario', desc: 'Propone hasta 2 productos relacionados con la cotización' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    desc: 'Perfil e historial del cliente',
    accent: '#8b5cf6',
    tools: [
      { name: 'historial_cliente',    label: 'Ver historial',     desc: 'Perfil y últimos pedidos del cliente (uso pasivo)' },
      { name: 'guardar_dato_cliente', label: 'Guardar dato',      desc: 'Actualiza el perfil cuando el cliente lo menciona explícitamente' },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Devuelve todas las tools (núcleo + todas las de agentes) */
export function getAllToolDefs(): ToolDef[] {
  return [
    ...CORE_TOOLS,
    ...AGENT_REGISTRY.flatMap((a) => a.tools),
  ]
}

/** Dado un nombre de tool, devuelve su agente o null si es núcleo */
export function findAgentForTool(toolName: string): AgentDef | null {
  return AGENT_REGISTRY.find((a) => a.tools.some((t) => t.name === toolName)) ?? null
}
