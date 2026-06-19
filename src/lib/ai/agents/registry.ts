// Registro central de agentes y herramientas del orquestador.
// Es la única fuente de verdad: UI, orquestador, integraciones y prompt leen de aquí.

export type IntegracionTipo =
  | 'gmail'
  | 'telegram'
  | 'resend'
  | 'drive'
  | 'calendar'
  | 'nubefact'
  | 'mercadopago'
  | 'google'      // OAuth único que cubre gmail + calendar + drive
  | 'ycloud'      // para herramientas que usen la API WhatsApp directamente

export interface ToolDef {
  name: string                            // coincide con TOOL_SCHEMAS + TOOL_EXECUTORS
  label: string                           // UI
  desc: string                            // UI — descripción corta
  nucleo?: boolean                        // siempre ON, no se puede apagar (solo para tools núcleo)
  requiereIntegracion?: IntegracionTipo   // si no está conectada → tool invisible al LLM
}

export interface AgentDef {
  id: string      // 'ventas' | 'comprobantes' | 'upsell' | 'crm' | ...
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
  // ─── VENTAS ──────────────────────────────────────────────────────────────────
  {
    id: 'ventas',
    label: 'Ventas',
    desc: 'Cotizaciones, pedidos, descuentos y pagos',
    accent: '#22c55e',
    tools: [
      { name: 'guardar_cotizacion',          label: 'Guardar cotización',      desc: 'Crea el registro de cotización en BD' },
      { name: 'generar_cotizacion_pdf',      label: 'PDF de cotización',       desc: 'Genera y envía por WhatsApp el PDF de la cotización activa' },
      { name: 'aplicar_descuento',           label: 'Aplicar descuento',       desc: 'Aplica un % o monto fijo de descuento a la cotización activa' },
      { name: 'crear_pedido',                label: 'Crear pedido',            desc: 'Confirma y crea el pedido definitivo' },
      { name: 'agregar_a_pedido_reciente',   label: 'Agregar al pedido',       desc: 'Agrega productos al pedido más reciente (ventana de gracia)' },
      { name: 'modificar_pedido',            label: 'Modificar pedido',        desc: 'Cambia cantidades o elimina productos de un pedido pendiente' },
      { name: 'generar_link_cobro_mp',       label: 'Link de pago MercadoPago', desc: 'Genera un link de cobro de MercadoPago para el pedido o cotización', requiereIntegracion: 'mercadopago' as const },
    ],
  },

  // ─── COMPROBANTES ─────────────────────────────────────────────────────────────
  {
    id: 'comprobantes',
    label: 'Comprobantes',
    desc: 'Boletas, facturas, notas de venta y proformas',
    accent: '#3b82f6',
    tools: [
      { name: 'solicitar_comprobante',       label: 'Emitir comprobante',      desc: 'Genera y envía el comprobante por WhatsApp' },
      { name: 'guardar_comprobante_drive',   label: 'Guardar PDF en Drive',    desc: 'Sube el PDF del comprobante a la carpeta FerroBot en Google Drive', requiereIntegracion: 'google' as const },
    ],
  },

  // ─── UPSELL ──────────────────────────────────────────────────────────────────
  {
    id: 'upsell',
    label: 'Upsell',
    desc: 'Sugerencias de productos complementarios',
    accent: '#f59e0b',
    tools: [
      { name: 'sugerir_complementario',      label: 'Sugerir complementario', desc: 'Propone hasta 2 productos relacionados con la cotización' },
    ],
  },

  // ─── CRM ─────────────────────────────────────────────────────────────────────
  {
    id: 'crm',
    label: 'CRM',
    desc: 'Perfil, historial y seguimiento del cliente',
    accent: '#8b5cf6',
    tools: [
      { name: 'historial_cliente',           label: 'Ver historial',           desc: 'Perfil y últimos pedidos del cliente (uso pasivo)' },
      { name: 'guardar_dato_cliente',        label: 'Guardar dato',            desc: 'Actualiza el perfil cuando el cliente lo menciona explícitamente' },
      { name: 'consultar_deuda_cliente',     label: 'Saldo pendiente',         desc: 'Muestra pedidos sin pagar del cliente para recordarle o gestionar crédito' },
      { name: 'registrar_email_cliente',     label: 'Guardar email',           desc: 'Guarda o actualiza el email del cliente en su perfil CRM' },
    ],
  },

  // ─── COMUNICACIONES ──────────────────────────────────────────────────────────
  {
    id: 'comunicaciones',
    label: 'Comunicaciones',
    desc: 'Email, Telegram y alertas a canales externos',
    accent: '#06b6d4',
    tools: [
      {
        name:                'notificar_telegram',
        label:               'Notificar Telegram',
        desc:                'Alerta al equipo en el canal Telegram de la tienda',
        requiereIntegracion: 'telegram' as const,
      },
      {
        name:                'enviar_cotizacion_email',
        label:               'Cotización por email (Resend)',
        desc:                'Envía el PDF de la cotización al email del cliente vía Resend',
        requiereIntegracion: 'resend' as const,
      },
      {
        name:                'notificar_pedido_email',
        label:               'Alerta de pedido por email (Resend)',
        desc:                'Notifica al dueño por email cuando se crea un pedido nuevo',
        requiereIntegracion: 'resend' as const,
      },
      {
        name:                'enviar_email_gmail',
        label:               'Email por Gmail',
        desc:                'Envía un email al cliente usando la cuenta Gmail conectada de la tienda',
        requiereIntegracion: 'google' as const,
      },
      {
        name:                'enviar_recordatorio_pago',
        label:               'Recordatorio de pago',
        desc:                'Envía recordatorio de pago pendiente al cliente por email (usa Gmail o Resend según lo que esté conectado)',
        requiereIntegracion: 'resend' as const,
      },
      {
        name:                'notificar_stock_bajo_telegram',
        label:               'Alerta stock bajo (Telegram)',
        desc:                'Envía al canal Telegram la lista de productos con stock por debajo del mínimo',
        requiereIntegracion: 'telegram' as const,
      },
    ],
  },

  // ─── AGENDA ──────────────────────────────────────────────────────────────────
  {
    id: 'agenda',
    label: 'Agenda',
    desc: 'Eventos, citas de entrega y visitas técnicas en Google Calendar',
    accent: '#10b981',
    tools: [
      {
        name:                'crear_evento_entrega',
        label:               'Evento de entrega',
        desc:                'Crea un evento en Google Calendar para la entrega del pedido',
        requiereIntegracion: 'google' as const,
      },
      {
        name:                'agendar_visita_tecnica',
        label:               'Visita técnica',
        desc:                'Agrega una cita de visita/instalación técnica al calendario de la tienda',
        requiereIntegracion: 'google' as const,
      },
      {
        name:                'consultar_agenda_hoy',
        label:               'Ver agenda de hoy',
        desc:                'Lista los eventos de Google Calendar del día para responder consultas del cliente',
        requiereIntegracion: 'google' as const,
      },
    ],
  },

  // ─── PAGOS ───────────────────────────────────────────────────────────────────
  {
    id: 'pagos',
    label: 'Pagos',
    desc: 'MercadoPago, registro de cobros y verificación de pagos',
    accent: '#f97316',
    tools: [
      {
        name:                'verificar_pago_mp',
        label:               'Verificar pago MP',
        desc:                'Consulta el estado de un pago de MercadoPago por ID de preferencia o pago',
        requiereIntegracion: 'mercadopago' as const,
      },
      { name: 'registrar_pago_manual',       label: 'Registrar pago manual',   desc: 'Registra un pago recibido (efectivo, Yape, transferencia) en el pedido sin pasar por MercadoPago' },
      { name: 'consultar_saldo_pendiente',   label: 'Saldo pendiente del pedido', desc: 'Calcula cuánto falta por pagar de un pedido, considerando abonos registrados' },
    ],
  },

  // ─── INVENTARIO ──────────────────────────────────────────────────────────────
  {
    id: 'inventario',
    label: 'Inventario',
    desc: 'Stock, alertas y ajustes de precios internos',
    accent: '#ef4444',
    tools: [
      { name: 'listar_stock_bajo',           label: 'Productos con stock bajo', desc: 'Lista productos con stock igual o menor al mínimo configurado (usa búsqueda en catálogo)' },
      { name: 'consultar_rotacion_producto', label: 'Rotación de producto',     desc: 'Muestra cuántas unidades se vendieron en los últimos N días para un producto' },
      {
        name:                'subir_catalogo_drive',
        label:               'Subir catálogo a Drive',
        desc:                'Exporta y sube el catálogo de productos como CSV a Google Drive',
        requiereIntegracion: 'google' as const,
      },
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
