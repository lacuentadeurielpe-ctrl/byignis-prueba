// Tools del orquestador — OpenAI/Anthropic compatible function calling
//
// REGLA CRÍTICA: ferretería aislada
// Cada tool recibe ferreteriaId como primer parámetro y lo valida en runtime.
// Nunca confiamos en que el modelo lo pase; el orquestador lo inyecta desde
// la sesión autenticada.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Producto, ProductoDigital, ZonaDelivery, DatosFlujoPedido, AgentesActivos } from '@/types/database'
import { AGENT_REGISTRY, CORE_TOOL_NAMES } from '@/lib/ai/agents/registry'
import { procesarItemsSolicitados, buscarProducto, formatearCotizacion } from '@/lib/bot/catalog-search'
import { pausarBot } from '@/lib/bot/session'
import { generarYEnviarComprobante, generarYEnviarCotizacionPDF, eliminarComprobantePedido } from '@/lib/pdf/generar-comprobante'
import { emitirBoleta, emitirFactura } from '@/lib/comprobantes/emitir'
import { consultarRuc, validarFormatoRuc } from '@/lib/sunat/ruc'
import type { WASender } from '@/lib/whatsapp/types'
import { enviarMensajeTelegram } from '@/lib/integrations/telegram'
import { enviarEmail } from '@/lib/integrations/resend'
import { getValidAccessToken } from '@/lib/integrations/google'
import { enviarEmailGmail } from '@/lib/integrations/gmail'
import { crearEventoCalendario, listarEventosHoy } from '@/lib/integrations/gcalendar'
import { subirArchivoaDrive, obtenerOCrearCarpetaFerroBot } from '@/lib/integrations/gdrive'
import { withTimeout } from '@/lib/utils'
import { CatalogRepository } from '@/lib/db/repositories/catalogo'
import { geocodificarDireccion, resolverGoogleApiKey } from '@/lib/delivery/geocoding'
import { crearEntrega } from '@/lib/delivery/assignment'
import { calcularETANuevoPedido } from '@/lib/delivery/eta-simple'
import { notificarAsignacion } from '@/lib/notifications/delivery.notifications'
import type { DeliveryNotificationContext } from '@/lib/notifications/types'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ToolContext {
  supabase: SupabaseClient
  ferreteriaId: string
  conversacionId: string
  clienteId: string
  telefonoCliente: string
  productos: Producto[]
  zonas: ZonaDelivery[]
  datosFlujo: DatosFlujoPedido | null
  ventanaGraciaMinutos?: number
  sender?: WASender
  agentesActivos?: AgentesActivos      // F4: si undefined → todo activo
  herramientasDesactivadas?: string[]  // tools explícitamente apagadas (desde bot_herramientas_desactivadas)
  integracionesConectadas?: string[]   // tipos de integración activas (para gating de tools que las requieren)
  umbralUpsellSoles?: number           // F5: monto mínimo de cotización para activar upsell (0 = siempre)
  nubefactTokenPlano?: string       // Inyectado
  productosDigitales?: ProductoDigital[]
  botModoCatalogo?: 'fisicos' | 'digitales' | 'ambos'
}

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
  motivo?: string
  mensaje?: string
}

function requireTenant(ctx: ToolContext): void {
  if (!ctx.ferreteriaId || typeof ctx.ferreteriaId !== 'string') {
    throw new Error('TENANT_MISSING: tool invoked without ferreteriaId')
  }
}

// ── Schemas (OpenAI/DeepSeek compatible) ──────────────────────────────────

export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'buscar_producto',
      description:
        'Busca uno o varios productos en el catálogo de la ferretería. ' +
        'Úsalo cuando el cliente mencione productos por nombre para saber si existen, ' +
        'qué precio tienen y cuánto stock hay. Soporta búsqueda aproximada.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Lista de productos a buscar con cantidades.',
            items: {
              type: 'object',
              properties: {
                nombre_buscado: { type: 'string', description: 'Nombre del producto tal como lo dijo el cliente.' },
                cantidad:       { type: 'number', description: 'Cantidad deseada. Usa 1 si no especificó.' },
              },
              required: ['nombre_buscado', 'cantidad'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_cotizacion',
      description:
        'Guarda la cotización en la base de datos después de buscar los productos. ' +
        'Llámala SIEMPRE después de buscar_producto cuando el cliente pide precios formales o quiere cotizar. ' +
        'Esto genera el registro en BD y prepara el flujo para la confirmación del pedido.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Items de la cotización con los datos devueltos por buscar_producto.',
            items: {
              type: 'object',
              properties: {
                producto_id:     { type: 'string',  description: 'UUID del producto (de buscar_producto).' },
                nombre_producto: { type: 'string',  description: 'Nombre del producto en catálogo.' },
                unidad:          { type: 'string',  description: 'Unidad de medida.' },
                cantidad:        { type: 'number',  description: 'Cantidad solicitada.' },
                precio_unitario: { type: 'number',  description: 'Precio por unidad.' },
                subtotal:        { type: 'number',  description: 'precio_unitario × cantidad.' },
                no_disponible:   { type: 'boolean', description: 'true si el producto no tiene stock.' },
                nota:            { type: 'string',  description: 'Nota del sistema (stock parcial, etc.).' },
              },
              required: ['nombre_producto', 'unidad', 'cantidad', 'precio_unitario', 'subtotal'],
            },
          },
          requiere_aprobacion: {
            type: 'boolean',
            description: 'true si algún item requiere aprobación del encargado por precio especial.',
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_pedido',
      description:
        'Crea el pedido definitivo en la base de datos. ' +
        'Para productos FÍSICOS: necesitas nombre, modalidad (delivery/recojo) y dirección si es delivery. ' +
        'Para productos DIGITALES: usa modalidad="digital" — NO pidas dirección ni zona. Solo el nombre (puede ser corto). ' +
        'Esto crea el pedido, descuenta stock y genera el comprobante.',
      parameters: {
        type: 'object',
        properties: {
          nombre_cliente:    { type: 'string', description: 'Nombre del cliente. Para digital puede ser nombre corto o alias.' },
          modalidad:         { type: 'string', enum: ['delivery', 'recojo', 'digital'], description: 'Modalidad: delivery o recojo para físicos; digital para productos digitales.' },
          direccion_entrega: { type: 'string', description: 'Dirección de entrega (solo obligatorio si modalidad=delivery).' },
          zona_nombre:       { type: 'string', description: 'Nombre de la zona de delivery si aplica.' },
        },
        required: ['nombre_cliente', 'modalidad'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obtener_stock',
      description: 'Consulta el stock actual de un producto por ID. Úsalo solo si necesitas stock en tiempo real después de buscar_producto.',
      parameters: {
        type: 'object',
        properties: {
          producto_id: { type: 'string', description: 'UUID del producto.' },
        },
        required: ['producto_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_pedido',
      description:
        'Consulta el estado de un pedido del cliente actual. ' +
        'Si numero_pedido no se pasa, retorna los pedidos más recientes del cliente.',
      parameters: {
        type: 'object',
        properties: {
          numero_pedido: { type: 'string', description: 'Número de pedido (ej: PED-0001). Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'info_ferreteria',
      description:
        'Devuelve información de la ferretería: horario, dirección, métodos de pago, zonas de delivery. ' +
        'Úsalo cuando el cliente pregunte por horarios, ubicación, cómo pagar o si hacen delivery.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agregar_a_pedido_reciente',
      description:
        'Agrega productos a un pedido recién confirmado (ventana de gracia). ' +
        'Úsalo SOLO cuando el cliente pide agregar algo a un pedido que acaba de hacer.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre_buscado: { type: 'string' },
                cantidad:       { type: 'number' },
              },
              required: ['nombre_buscado', 'cantidad'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sugerir_complementario',
      description:
        'Busca productos complementarios para lo que el cliente está comprando. ' +
        'Úsalo SOLO después de guardar_cotizacion. Máximo 2 sugerencias. Si no hay nada complementario, devuelve vacío.',
      parameters: {
        type: 'object',
        properties: {
          producto_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs de los productos en la cotización actual.',
          },
        },
        required: ['producto_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'historial_cliente',
      description:
        'Devuelve el perfil y últimos pedidos del cliente. ' +
        'IMPORTANTE: contexto PASIVO — no mencionarlo al cliente a menos que él lo traiga.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_dato_cliente',
      description:
        'Guarda un dato del cliente que él mencionó EXPLÍCITAMENTE. ' +
        'Solo cuando la confianza es alta (lo dijo claramente, no inferido).',
      parameters: {
        type: 'object',
        properties: {
          campo: {
            type: 'string',
            enum: [
              'tipo_cliente', 'obra_actual', 'zona_habitual', 'modalidad_preferida',
              'metodo_pago_preferido', 'presupuesto_obra', 'tiene_ruc', 'giro_negocio',
            ],
            description: 'Campo del perfil a actualizar.',
          },
          valor: { type: 'string', description: 'Valor mencionado por el cliente.' },
        },
        required: ['campo', 'valor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalar_humano',
      description:
        'Pausa el bot y notifica al dueño para atención manual. ' +
        'Úsalo SOLO cuando el cliente pida hablar con una persona o haya una queja seria.',
      parameters: {
        type: 'object',
        properties: {
          razon: { type: 'string', description: 'Razón breve del escalamiento.' },
        },
        required: ['razon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'solicitar_comprobante',
      description:
        'Genera y envía por WhatsApp el comprobante de un pedido del cliente. ' +
        'Úsalo cuando el cliente pida boleta, factura, nota de venta, proforma o comprobante. ' +
        'Maneja automáticamente: proforma (pendiente), nota de venta (no pagado/sin Nubefact), ' +
        'boleta electrónica (pagado + Nubefact), factura electrónica (pagado + Nubefact + RUC).',
      parameters: {
        type: 'object',
        properties: {
          numero_pedido: {
            type: 'string',
            description: 'Número de pedido si el cliente lo especificó (ej: PED-0001). Omitir si no lo mencionó.',
          },
          tipo_comprobante: {
            type: 'string',
            enum: ['boleta', 'factura'],
            description: 'Tipo de comprobante solicitado. Omitir si el cliente no lo especificó (se elige automáticamente).',
          },
          ruc_cliente: {
            type: 'string',
            description: 'RUC del cliente (11 dígitos) si pidió factura y lo proporcionó.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generar_cotizacion_pdf',
      description:
        'Genera y envía por WhatsApp el PDF de la cotización activa como proforma (lista de precios). ' +
        'Úsalo cuando el cliente pide la cotización por escrito, en PDF, o quiere guardársela. ' +
        'La cotización debe haberse guardado antes con guardar_cotizacion.',
      parameters: {
        type: 'object',
        properties: {
          nombre_cliente: {
            type: 'string',
            description: 'Nombre del cliente para el PDF (opcional, si ya se conoce).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modificar_pedido',
      description:
        'Modifica un pedido pendiente del cliente: agrega, quita o ajusta cantidades de productos. ' +
        'Úsalo cuando el cliente quiera cambiar su pedido ANTES de que sea confirmado. ' +
        'Para cantidad = 0 → elimina ese producto. Para cantidad > 0 → agrega o ajusta.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Lista de cambios a aplicar.',
            items: {
              type: 'object',
              properties: {
                nombre_buscado: { type: 'string', description: 'Nombre del producto a modificar.' },
                cantidad: {
                  type: 'number',
                  description: 'Nueva cantidad. Usa 0 para eliminar el producto del pedido.',
                },
              },
              required: ['nombre_buscado', 'cantidad'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notificar_telegram',
      description:
        'Envía un mensaje al canal Telegram de la tienda. ' +
        'Úsalo para alertar al equipo sobre pedidos grandes, solicitudes especiales, ' +
        'o cuando el cliente requiere atención que el bot no puede resolver. ' +
        'Solo disponible si Telegram está configurado en Integraciones.',
      parameters: {
        type: 'object',
        properties: {
          mensaje: {
            type: 'string',
            description: 'Texto de la notificación. Sé conciso — máximo 3 líneas.',
          },
        },
        required: ['mensaje'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_cotizacion_email',
      description:
        'Envía el PDF de la cotización activa al email del cliente. ' +
        'Úsalo cuando el cliente pida recibir la cotización por email. ' +
        'Solo disponible si Resend está configurado en Integraciones.',
      parameters: {
        type: 'object',
        properties: {
          email_cliente: {
            type: 'string',
            description: 'Email del cliente al que enviar la cotización.',
          },
          cotizacion_id: {
            type: 'string',
            description: 'ID de la cotización a enviar. Si no se especifica, usa la activa de la conversación.',
          },
        },
        required: ['email_cliente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notificar_pedido_email',
      description:
        'Envía un email interno al dueño de la tienda cuando se crea un pedido. ' +
        'Úsalo automáticamente al crear un pedido si Resend está configurado. ' +
        'Solo disponible si Resend está configurado en Integraciones.',
      parameters: {
        type: 'object',
        properties: {
          pedido_numero: {
            type: 'string',
            description: 'Número del pedido a notificar.',
          },
          resumen: {
            type: 'string',
            description: 'Resumen breve del pedido: cliente, productos principales y total.',
          },
        },
        required: ['pedido_numero', 'resumen'],
      },
    },
  },

  // ── VENTAS: descuento + link MP ───────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'aplicar_descuento',
      description:
        'Aplica un descuento (porcentual o monto fijo en soles) a la cotización activa. ' +
        'Úsalo cuando el cliente pida descuento o el vendedor quiera ajustar el precio.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['porcentaje', 'fijo'], description: 'Tipo de descuento.' },
          valor: { type: 'number', description: 'Porcentaje (0-100) o monto en soles.' },
          motivo: { type: 'string', description: 'Razón del descuento (opcional, para registro).' },
        },
        required: ['tipo', 'valor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generar_link_cobro_mp',
      description:
        'Genera un link de pago de MercadoPago para que el cliente pague en línea. ' +
        'Úsalo cuando el cliente quiera pagar con tarjeta o confirme el pedido y prefiera pago online. ' +
        'Solo disponible si MercadoPago está conectado.',
      parameters: {
        type: 'object',
        properties: {
          pedido_id:    { type: 'string', description: 'ID del pedido a cobrar.' },
          monto_soles:  { type: 'number', description: 'Monto total a cobrar en soles.' },
          descripcion:  { type: 'string', description: 'Descripción breve (ej: "Cemento + arena").' },
        },
        required: ['monto_soles', 'descripcion'],
      },
    },
  },

  // ── CRM: deuda + email cliente ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'consultar_deuda_cliente',
      description:
        'Muestra los pedidos sin pagar del cliente actual. ' +
        'Úsalo cuando el cliente pregunte por su saldo pendiente o para verificar crédito antes de un pedido grande.',
      parameters: {
        type: 'object',
        properties: {
          limite: { type: 'integer', description: 'Máximo de pedidos a mostrar (default 5).', default: 5 },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_email_cliente',
      description:
        'Guarda o actualiza el email del cliente en su perfil CRM. ' +
        'Úsalo cuando el cliente mencione su email explícitamente.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Dirección de email del cliente.' },
        },
        required: ['email'],
      },
    },
  },

  // ── COMUNICACIONES: Gmail + recordatorio ──────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'enviar_email_gmail',
      description:
        'Envía un email al cliente usando la cuenta Gmail conectada de la tienda. ' +
        'Úsalo para cotizaciones, confirmaciones de pedido o mensajes personalizados cuando el cliente da su email. ' +
        'Solo disponible si Google está conectado en Integraciones.',
      parameters: {
        type: 'object',
        properties: {
          email_destino: { type: 'string', description: 'Email del destinatario.' },
          asunto:        { type: 'string', description: 'Asunto del email.' },
          cuerpo_html:   { type: 'string', description: 'Cuerpo del email en HTML simple.' },
        },
        required: ['email_destino', 'asunto', 'cuerpo_html'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_recordatorio_pago',
      description:
        'Envía un recordatorio de pago pendiente al cliente por email. ' +
        'Úsalo cuando el cliente tiene pedidos sin pagar y da su email. ' +
        'Requiere Resend o Google conectado.',
      parameters: {
        type: 'object',
        properties: {
          email_cliente: { type: 'string', description: 'Email del cliente.' },
          pedidos:       { type: 'string', description: 'Descripción de los pedidos pendientes (números y montos).' },
          total_soles:   { type: 'number', description: 'Monto total adeudado.' },
        },
        required: ['email_cliente', 'pedidos', 'total_soles'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notificar_stock_bajo_telegram',
      description:
        'Envía al canal Telegram la lista de productos cuyo stock está por debajo del mínimo. ' +
        'Úsalo cuando el dueño pida un reporte de stock o cuando el bot detecte stock crítico en una consulta. ' +
        'Solo disponible si Telegram está configurado.',
      parameters: {
        type: 'object',
        properties: {
          productos: {
            type: 'string',
            description: 'Lista de productos con stock bajo (texto con nombres y cantidades).',
          },
        },
        required: ['productos'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_comprobante_drive',
      description:
        'Sube el PDF de un comprobante (cotización, nota de venta) a la carpeta FerroBot en Google Drive. ' +
        'Úsalo automáticamente después de generar un comprobante si Google Drive está conectado. ' +
        'Solo disponible si Google está conectado.',
      parameters: {
        type: 'object',
        properties: {
          pdf_url:  { type: 'string', description: 'URL pública del PDF en Supabase Storage.' },
          nombre:   { type: 'string', description: 'Nombre del archivo sin extensión (ej: "COT-001-Juan").' },
          tipo:     { type: 'string', enum: ['cotizacion', 'nota_venta', 'boleta', 'factura'], description: 'Tipo de documento.' },
        },
        required: ['pdf_url', 'nombre', 'tipo'],
      },
    },
  },

  // ── AGENDA: Google Calendar ───────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'crear_evento_entrega',
      description:
        'Crea un evento en Google Calendar para la entrega de un pedido. ' +
        'Úsalo cuando se confirma un pedido con delivery y se acuerda hora de entrega con el cliente. ' +
        'Solo disponible si Google está conectado.',
      parameters: {
        type: 'object',
        properties: {
          titulo:      { type: 'string', description: 'Título del evento (ej: "Entrega pedido 001 — Juan Pérez").' },
          fecha_hora_inicio: { type: 'string', description: 'Fecha y hora de inicio en formato ISO 8601 (ej: "2025-06-20T10:00:00-05:00").' },
          fecha_hora_fin:    { type: 'string', description: 'Fecha y hora de fin en formato ISO 8601.' },
          descripcion: { type: 'string', description: 'Detalle del pedido y dirección de entrega.' },
          email_cliente: { type: 'string', description: 'Email del cliente para enviarle la invitación (opcional).' },
        },
        required: ['titulo', 'fecha_hora_inicio', 'fecha_hora_fin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_visita_tecnica',
      description:
        'Crea una cita de visita o instalación técnica en Google Calendar. ' +
        'Úsalo cuando el cliente solicita instalación, medición o asesoría en obra. ' +
        'Solo disponible si Google está conectado.',
      parameters: {
        type: 'object',
        properties: {
          titulo:      { type: 'string', description: 'Título (ej: "Visita técnica — Av. Lima 123").' },
          fecha_hora_inicio: { type: 'string', description: 'Inicio en formato ISO 8601.' },
          fecha_hora_fin:    { type: 'string', description: 'Fin en formato ISO 8601.' },
          descripcion: { type: 'string', description: 'Notas: cliente, productos a instalar, dirección.' },
          email_cliente: { type: 'string', description: 'Email del cliente (opcional).' },
        },
        required: ['titulo', 'fecha_hora_inicio', 'fecha_hora_fin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_agenda_hoy',
      description:
        'Lista los eventos de Google Calendar del día de hoy. ' +
        'Úsalo cuando el cliente pregunte "¿tienen agenda hoy?" o para verificar disponibilidad. ' +
        'Solo disponible si Google está conectado.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },

  // ── PAGOS: MP verificar + pago manual + saldo ─────────────────────────────
  {
    type: 'function',
    function: {
      name: 'verificar_pago_mp',
      description:
        'Consulta el estado de un pago en MercadoPago por ID de preferencia. ' +
        'Úsalo cuando el cliente dice que ya pagó y quieres confirmar la transacción. ' +
        'Solo disponible si MercadoPago está conectado.',
      parameters: {
        type: 'object',
        properties: {
          preference_id: { type: 'string', description: 'ID de la preferencia o del pago en MercadoPago.' },
        },
        required: ['preference_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_pago_manual',
      description:
        'Registra un abono o pago recibido de forma manual (efectivo, Yape, transferencia) en un pedido. ' +
        'Úsalo cuando el cliente confirma que pagó fuera de MercadoPago.',
      parameters: {
        type: 'object',
        properties: {
          pedido_id:    { type: 'string', description: 'ID del pedido.' },
          monto_soles:  { type: 'number', description: 'Monto recibido en soles.' },
          metodo:       { type: 'string', enum: ['efectivo', 'yape', 'plin', 'transferencia', 'otro'], description: 'Método de pago.' },
          notas:        { type: 'string', description: 'Notas adicionales (número de operación, etc.).' },
        },
        required: ['pedido_id', 'monto_soles', 'metodo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_saldo_pendiente',
      description:
        'Calcula el saldo pendiente de un pedido, considerando el total y los abonos registrados. ' +
        'Úsalo cuando el cliente pregunta cuánto le falta por pagar.',
      parameters: {
        type: 'object',
        properties: {
          pedido_id: { type: 'string', description: 'ID del pedido.' },
        },
        required: ['pedido_id'],
      },
    },
  },

  // ── PAGOS: crédito formal ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'consultar_credito_formal',
      description:
        'Consulta las líneas de crédito formal del cliente actual (tabla creditos). ' +
        'Distinto de consultar_deuda_cliente que muestra pedidos sin pagar: ' +
        'este muestra créditos aprobados con monto, fecha de vencimiento y saldo real. ' +
        'Úsalo cuando el cliente pregunta por su crédito, su saldo de crédito o cuánto debe de crédito.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['activo', 'vencido', 'todos'],
            description: 'Filtrar por estado del crédito. Por defecto muestra activos y vencidos.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_abono_credito',
      description:
        'Registra un pago parcial o total contra una línea de crédito formal. ' +
        'Úsalo cuando el cliente quiere abonar a su crédito. ' +
        'Obtén el credito_id con consultar_credito_formal primero si no lo tienes.',
      parameters: {
        type: 'object',
        properties: {
          credito_id:  { type: 'string',  description: 'UUID del crédito (obtenido con consultar_credito_formal).' },
          monto:       { type: 'number',  description: 'Monto del abono en soles (debe ser > 0).' },
          metodo_pago: { type: 'string',  enum: ['efectivo', 'yape', 'plin', 'transferencia', 'otro'], description: 'Forma de pago del abono.' },
          notas:       { type: 'string',  description: 'Notas adicionales (número de operación, etc.).' },
        },
        required: ['credito_id', 'monto'],
      },
    },
  },

  // ── INVENTARIO ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'listar_stock_bajo',
      description:
        'Lista los productos cuyo stock es igual o menor al mínimo configurado. ' +
        'Úsalo cuando el dueño pida reporte de stock o cuando el bot detecte stock crítico.',
      parameters: {
        type: 'object',
        properties: {
          limite: { type: 'integer', description: 'Máximo de productos a listar (default 15).', default: 15 },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_rotacion_producto',
      description:
        'Muestra cuántas unidades de un producto se vendieron en los últimos N días. ' +
        'Úsalo cuando el dueño pregunte por el movimiento de un producto.',
      parameters: {
        type: 'object',
        properties: {
          producto_nombre: { type: 'string', description: 'Nombre del producto a consultar.' },
          dias:            { type: 'integer', description: 'Período en días (default 30).', default: 30 },
        },
        required: ['producto_nombre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'subir_catalogo_drive',
      description:
        'Exporta el catálogo de productos como CSV y lo sube a Google Drive. ' +
        'Úsalo cuando el dueño quiera compartir el catálogo actualizado. ' +
        'Solo disponible si Google está conectado.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
] as const

// ── Agentes y gating de herramientas (basado en AGENT_REGISTRY) ──────────────

export type ToolSchema = (typeof TOOL_SCHEMAS)[number]

/**
 * Devuelve los schemas de tools activos para el tenant.
 *
 * Reglas (opt-out: campo ausente = activo):
 *  - Tools núcleo (en CORE_TOOL_NAMES) → siempre incluidas.
 *  - Tools de agente → incluidas si:
 *      1. el agente NO está en false en `agentes`,  Y
 *      2. no está en `herramientasDesactivadas`,     Y
 *      3. no tiene `requiereIntegracion` o la integración está en `integracionesConectadas`.
 */
export function getActiveToolSchemas(
  agentes?: AgentesActivos,
  herramientasDesactivadas?: string[],
  integracionesConectadas?: string[],
): ToolSchema[] {
  const desactivadas  = new Set(herramientasDesactivadas ?? [])
  const integraciones = new Set(integracionesConectadas ?? [])

  // Build owner map: una tool puede aparecer en varios agentes (ej: consultar_deuda_cliente en ventas+crm)
  type OwnerEntry = { agentKey: keyof AgentesActivos; requiereIntegracion?: string }
  const toolOwners = new Map<string, OwnerEntry[]>()
  for (const agent of AGENT_REGISTRY) {
    for (const tool of agent.tools) {
      const owners = toolOwners.get(tool.name) ?? []
      owners.push({ agentKey: agent.id as keyof AgentesActivos, requiereIntegracion: tool.requiereIntegracion })
      toolOwners.set(tool.name, owners)
    }
  }

  const disabled = new Set<string>()
  for (const [toolName, owners] of toolOwners) {
    // Toggle explícito del usuario → siempre desactivada (prioridad máxima)
    if (desactivadas.has(toolName)) { disabled.add(toolName); continue }

    // Una tool se desactiva sólo si TODOS sus agentes propietarios la desactivan
    const anyEnabled = owners.some(({ agentKey, requiereIntegracion }) => {
      const agentOff   = agentes?.[agentKey] === false
      const integrFalta = !!requiereIntegracion && !integraciones.has(requiereIntegracion)
      return !agentOff && !integrFalta
    })
    if (!anyEnabled) disabled.add(toolName)
  }

  return (TOOL_SCHEMAS as unknown as ToolSchema[]).filter(
    (s) => CORE_TOOL_NAMES.has(s.function.name) || !disabled.has(s.function.name)
  )
}

// ── Executors ────────────────────────────────────────────────────────────────

type Executor = (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>

function buscarProductoDigital(nombreBuscado: string, productos: ProductoDigital[]): ProductoDigital | null {
  const activos = productos.filter((p) => p.activo && (p.stock === null || p.stock > 0))
  if (!activos.length) return null

  const norm = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()

  const buscado = norm(nombreBuscado)
  const tokensB = new Set(buscado.split(/\s+/).filter((t) => t.length > 2))

  let mejorMatch: ProductoDigital | null = null
  let mejorScore = 0

  for (const p of activos) {
    const nombreNorm = norm(p.nombre)

    // Substring match → return immediately
    if (nombreNorm.includes(buscado) || buscado.includes(nombreNorm)) return p

    // Tag match
    for (const tag of p.tags) {
      const tagNorm = norm(tag)
      if (tagNorm.includes(buscado) || buscado.includes(tagNorm)) return p
    }

    // Token overlap score
    const tokensP = new Set(nombreNorm.split(/\s+/).filter((t) => t.length > 2))
    const matches = [...tokensB].filter((t) => tokensP.has(t)).length
    const score = tokensB.size > 0 ? matches / tokensB.size : 0
    if (score >= 0.5 && score > mejorScore) {
      mejorScore = score
      mejorMatch = p
    }
  }

  return mejorMatch
}

function tokenizarProductos(nombres: string[]): Set<string> {
  const tokens = new Set<string>()
  for (const nombre of nombres) {
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .forEach((t) => tokens.add(t))
  }
  return tokens
}

export const TOOL_EXECUTORS: Record<string, Executor> = {

  buscar_producto: async (ctx, args) => {
    requireTenant(ctx)
    const items = args.items as Array<{ nombre_buscado: string; cantidad: number }> | undefined
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'items vacío' }

    const modo = ctx.botModoCatalogo ?? 'fisicos'
    const buscarFisicos   = modo !== 'digitales'
    const buscarDigitales = modo !== 'fisicos' && (ctx.productosDigitales?.length ?? 0) > 0

    // Physical search (skipped in 'digitales' mode)
    const fisicosProcesados = buscarFisicos
      ? procesarItemsSolicitados(items, ctx.productos)
      : items.map((i) => ({
          nombre_buscado: i.nombre_buscado,
          cantidad: i.cantidad,
          producto: null,
          precio_unitario: null,
          stock_disponible: null,
          disponible: false,
          nota: null,
          requiere_aprobacion: false,
        }))

    const resumen = fisicosProcesados.map((r) => {
      // Physical product found OR digital search disabled
      if (r.producto || !buscarDigitales) {
        return {
          nombre_buscado:      r.nombre_buscado,
          cantidad_solicitada: r.cantidad,
          encontrado:          !!r.producto,
          producto_id:         r.producto?.id ?? null,
          nombre_catalogo:     r.producto?.nombre ?? null,
          unidad:              r.producto?.unidad ?? null,
          precio_unitario:     r.precio_unitario,
          stock:               r.stock_disponible,
          disponible:          r.disponible,
          nota:                r.nota,
          requiere_aprobacion: r.requiere_aprobacion,
          es_digital:          false,
        }
      }

      // Try digital products
      const pd = buscarProductoDigital(r.nombre_buscado, ctx.productosDigitales!)
      if (pd) {
        const stockDisp = pd.stock === null ? 999 : pd.stock
        return {
          nombre_buscado:      r.nombre_buscado,
          cantidad_solicitada: r.cantidad,
          encontrado:          true,
          producto_id:         pd.id,
          nombre_catalogo:     pd.nombre,
          unidad:              pd.unidad,
          precio_unitario:     pd.precio,
          stock:               pd.stock,
          disponible:          pd.activo && stockDisp > 0,
          nota:                `Producto digital — entrega: ${pd.tipos_entrega.join(', ')}`,
          requiere_aprobacion: false,
          es_digital:          true,
        }
      }

      // Not found anywhere
      return {
        nombre_buscado:      r.nombre_buscado,
        cantidad_solicitada: r.cantidad,
        encontrado:          false,
        producto_id:         null,
        nombre_catalogo:     null,
        unidad:              null,
        precio_unitario:     null,
        stock:               null,
        disponible:          false,
        nota:                r.nota ?? 'No encontrado en el catálogo',
        requiere_aprobacion: false,
        es_digital:          false,
      }
    })

    return { ok: true, data: { resultados: resumen } }
  },

  guardar_cotizacion: async (ctx, args) => {
    requireTenant(ctx)

    type ItemCotArg = {
      producto_id?: string
      nombre_producto: string
      unidad: string
      cantidad: number
      precio_unitario: number
      subtotal: number
      no_disponible?: boolean
      nota?: string
    }

    const items = args.items as ItemCotArg[] | undefined
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'items vacío' }

    const requiereAprobacion = (args.requiere_aprobacion as boolean | undefined) ?? false
    const disponibles = items.filter((i) => !i.no_disponible)
    const total = disponibles.reduce((sum, i) => sum + i.subtotal, 0)

    if (disponibles.length === 0) {
      return { ok: false, error: 'Ningún item disponible para cotizar', motivo: 'sin_disponibles' }
    }

    // Guardar cotización
    const { data: cotizacion, error: errCot } = await ctx.supabase
      .from('cotizaciones')
      .insert({
        ferreteria_id:    ctx.ferreteriaId,
        conversacion_id:  ctx.conversacionId,
        cliente_id:       ctx.clienteId,
        estado:           requiereAprobacion ? 'pendiente_aprobacion' : 'enviada',
        total,
        requiere_aprobacion: requiereAprobacion,
      })
      .select().single()

    if (errCot || !cotizacion) {
      console.error('[guardar_cotizacion] Error BD:', errCot?.message)
      return { ok: false, error: 'Error al guardar la cotización' }
    }

    const cotId = (cotizacion as unknown as { id: string }).id

    // Guardar items
    await ctx.supabase.from('items_cotizacion').insert(
      items.map((i) => ({
        cotizacion_id:       cotId,
        producto_id:         i.producto_id ?? null,
        nombre_producto:     i.nombre_producto,
        unidad:              i.unidad,
        cantidad:            i.cantidad,
        precio_unitario:     i.precio_unitario,
        precio_original:     i.precio_unitario,   // snapshot del precio base
        subtotal:            i.subtotal,
        no_disponible:       i.no_disponible ?? false,
        nota_disponibilidad: i.nota ?? null,
      }))
    )

    // Actualizar datos_flujo para saber que hay cotización esperando confirmación
    if (!requiereAprobacion) {
      await ctx.supabase
        .from('conversaciones')
        .update({ datos_flujo: { cotizacion_id: cotId, paso: 'esperando_confirmacion' } })
        .eq('id', ctx.conversacionId)
    }

    return {
      ok: true,
      data: {
        cotizacion_id:     cotId,
        total,
        requiere_aprobacion: requiereAprobacion,
        items_disponibles:   disponibles.length,
        items_no_disponibles: items.length - disponibles.length,
      },
    }
  },

  crear_pedido: async (ctx, args) => {
    requireTenant(ctx)

    const nombreCliente    = (args.nombre_cliente as string | undefined)?.trim()
    const modalidadRaw     = args.modalidad as 'delivery' | 'recojo' | 'digital' | undefined
    const esDigital        = modalidadRaw === 'digital'
    // Para la BD usamos 'recojo' cuando es digital (no hay delivery físico)
    const modalidad        = esDigital ? 'recojo' : modalidadRaw
    const direccionEntrega = (args.direccion_entrega as string | undefined)?.trim() || null
    const zonaNombre       = (args.zona_nombre as string | undefined)?.trim() || null

    if (!nombreCliente) return { ok: false, error: 'nombre_cliente es requerido', motivo: 'falta_nombre' }
    if (!modalidadRaw)  return { ok: false, error: 'modalidad es requerida',       motivo: 'falta_modalidad' }
    if (modalidad === 'delivery' && !direccionEntrega) {
      return { ok: false, error: 'dirección de entrega requerida para delivery', motivo: 'falta_direccion' }
    }

    // Buscar cotización activa de esta conversación
    const cotizacionId = ctx.datosFlujo?.cotizacion_id
    if (!cotizacionId) {
      return {
        ok: false,
        error: 'No hay cotización activa. Primero usa buscar_producto y guardar_cotizacion.',
        motivo: 'sin_cotizacion',
      }
    }

    const { data: cotizacion, error: errCot } = await ctx.supabase
      .from('cotizaciones')
      .select('*, items_cotizacion(*)')
      .eq('id', cotizacionId)
      .eq('ferreteria_id', ctx.ferreteriaId)    // FERRETERÍA AISLADA
      .in('estado', ['enviada', 'aprobada'])
      .single()

    if (errCot || !cotizacion) {
      return { ok: false, error: 'Cotización no encontrada o ya procesada', motivo: 'cotizacion_no_encontrada' }
    }

    // Buscar zona de delivery si aplica
    let zonaId: string | null = null
    if (modalidad === 'delivery' && zonaNombre && ctx.zonas.length > 0) {
      const zonaMatch = ctx.zonas.find((z) =>
        z.nombre.toLowerCase().includes(zonaNombre.toLowerCase())
      )
      if (zonaMatch) zonaId = zonaMatch.id
    }

    // Generar número de pedido
    const { data: numeroPedido } = await ctx.supabase
      .rpc('generar_numero_pedido', { p_ferreteria_id: ctx.ferreteriaId })

    // Preparar items desde la cotización
    const productoCostoMap = new Map(ctx.productos.map((p) => [p.id, p.precio_compra ?? 0]))
    const itemsCotizacion  = (cotizacion as unknown as { items_cotizacion: Array<Record<string, unknown>> }).items_cotizacion ?? []
    const itemsParaPedido  = itemsCotizacion
      .filter((i) => !i.no_disponible)
      .map((i) => ({
        producto_id:     i.producto_id as string | null,
        nombre_producto: i.nombre_producto as string,
        unidad:          i.unidad as string,
        cantidad:        i.cantidad as number,
        precio_unitario: i.precio_unitario as number,
        subtotal:        i.subtotal as number,
        costo_unitario:  productoCostoMap.get(i.producto_id as string) ?? 0,
      }))

    if (itemsParaPedido.length === 0) {
      return { ok: false, error: 'La cotización no tiene items disponibles', motivo: 'sin_items' }
    }

    const costoTotal = itemsParaPedido.reduce((sum, i) => sum + i.costo_unitario * i.cantidad, 0)
    const total      = (cotizacion as unknown as { total: number }).total

    // Crear el pedido
    const { data: pedido, error: errPed } = await ctx.supabase
      .from('pedidos')
      .insert({
        ferreteria_id:    ctx.ferreteriaId,
        cotizacion_id:    cotizacionId,
        cliente_id:       ctx.clienteId,
        numero_pedido:    numeroPedido,
        nombre_cliente:   nombreCliente,
        telefono_cliente: ctx.telefonoCliente,
        direccion_entrega: direccionEntrega,
        zona_delivery_id: zonaId,
        modalidad,
        estado:      'confirmado',
        total,
        costo_total: costoTotal,
      })
      .select().single()

    if (errPed || !pedido) {
      console.error('[crear_pedido] Error BD:', errPed?.message)
      return { ok: false, error: 'Error al crear el pedido en la base de datos' }
    }

    const pedidoId = (pedido as unknown as { id: string }).id

    // Insertar items del pedido
    await ctx.supabase.from('items_pedido').insert(
      itemsParaPedido.map((i) => ({ pedido_id: pedidoId, ...i }))
    )

    // Descontar stock (fire-and-forget)
    ctx.supabase.rpc('reducir_stock_pedido', { p_pedido_id: pedidoId })
      .then(({ error: e }) => { if (e) console.error('[crear_pedido] Error stock:', e.message) })

    // Marcar cotización como aprobada
    await ctx.supabase
      .from('cotizaciones')
      .update({ estado: 'aprobada' })
      .eq('id', cotizacionId)
      .eq('ferreteria_id', ctx.ferreteriaId)

    // Actualizar nombre del cliente si no lo tenía
    await ctx.supabase
      .from('clientes')
      .update({ nombre: nombreCliente })
      .eq('id', ctx.clienteId)
      .is('nombre', null)

    // Actualizar perfil del cliente (compras frecuentes + modalidad)
    try {
      const { data: clienteActual } = await ctx.supabase
        .from('clientes').select('perfil')
        .eq('id', ctx.clienteId).eq('ferreteria_id', ctx.ferreteriaId).single()

      const perfilBase       = (clienteActual?.perfil as Record<string, unknown> | null) ?? {}
      const comprasPrevias   = Array.isArray(perfilBase.compras_frecuentes)
        ? (perfilBase.compras_frecuentes as string[]) : []
      const nombresNuevos    = itemsParaPedido.map((i) => i.nombre_producto).filter(Boolean)
      const comprasUnicas    = Array.from(new Set([...nombresNuevos, ...comprasPrevias])).slice(0, 20)
      const perfilNuevo: Record<string, unknown> = {
        ...perfilBase,
        compras_frecuentes: comprasUnicas,
        modalidad_preferida: esDigital ? 'digital' : modalidad,
      }
      if (modalidad === 'delivery' && zonaNombre) perfilNuevo.zona_habitual = zonaNombre

      await ctx.supabase.from('clientes').update({ perfil: perfilNuevo })
        .eq('id', ctx.clienteId).eq('ferreteria_id', ctx.ferreteriaId)
    } catch (e) {
      console.error('[crear_pedido] Error perfil cliente:', e)
    }

    // Limpiar flujo de la conversación
    await ctx.supabase.from('conversaciones')
      .update({ datos_flujo: null })
      .eq('id', ctx.conversacionId)

    // Generar y enviar comprobante (PDF + WhatsApp)
    generarYEnviarComprobante({
      pedidoId:     pedidoId,
      ferreteriaId: ctx.ferreteriaId,
      sender: ctx.sender,
    }).catch((e) => console.error('[crear_pedido] Error comprobante:', e))

    // Enviar instrucciones de pago si hay métodos digitales configurados
    try {
      const { data: ferrPago } = await ctx.supabase
        .from('ferreterias')
        .select('telefono_whatsapp, metodos_pago_activos, datos_yape, datos_transferencia')
        .eq('id', ctx.ferreteriaId)
        .single()

      if (ferrPago && ctx.sender) {
        const metodosActivos: string[] = (ferrPago as unknown as { metodos_pago_activos?: string[] }).metodos_pago_activos ?? []
        const datosYape = (ferrPago as unknown as { datos_yape?: Record<string, string> }).datos_yape ?? null
        const datosTransferencia = (ferrPago as unknown as { datos_transferencia?: Record<string, string> }).datos_transferencia ?? null

        const lineasPago: string[] = []
        if (metodosActivos.includes('yape') && datosYape?.numero) {
          lineasPago.push(`💚 *Yape:* ${datosYape.numero}`)
        }
        if (metodosActivos.includes('transferencia') && datosTransferencia?.banco) {
          lineasPago.push(
            `🏦 *Transferencia (${datosTransferencia.banco}):*\n` +
            `  Cuenta: ${datosTransferencia.cuenta}\n` +
            (datosTransferencia.cci ? `  CCI: ${datosTransferencia.cci}\n` : '') +
            `  Titular: ${datosTransferencia.titular}`
          )
        }
        if (metodosActivos.includes('efectivo')) {
          lineasPago.push(`💵 *Efectivo* al momento de la entrega`)
        }

        if (lineasPago.length > 0) {
          const textoPago =
            `💳 *Formas de pago disponibles:*\n\n` +
            lineasPago.join('\n\n') +
            `\n\nSi pagas por Yape o transferencia, envía el comprobante y lo confirmaremos. 🙏`
          ctx.sender.enviarMensaje({ to: ctx.telefonoCliente, texto: textoPago })
            .catch((e) => console.error('[crear_pedido] Error instrucciones pago:', e))

          if (metodosActivos.includes('yape') && datosYape?.qr_url) {
            ctx.sender.enviarImagen({ to: ctx.telefonoCliente, imageUrl: datosYape.qr_url, caption: `QR de Yape — ${datosYape.numero}` })
              .catch((e) => console.error('[crear_pedido] Error QR Yape:', e))
          }
        }
      }
    } catch (e) {
      console.error('[crear_pedido] Error instrucciones pago:', e)
    }

    // ── Logística de delivery: entrega + ventana de agenda + notificación ────
    // La ventana de entrega la define la agenda del vehículo (declarada/encadenada
    // por el repartidor), no un ETA algorítmico. Geocodificamos solo para guardar
    // coords (tracking/mapas), de forma best-effort.
    if (modalidad === 'delivery' && direccionEntrega) {
      ;(async () => {
        try {
          const { data: ferr } = await ctx.supabase
            .from('ferreterias')
            .select('lat, lng, nombre, telefono_whatsapp')
            .eq('id', ctx.ferreteriaId)
            .single()

          // Geocodificar para guardar coords del cliente (best-effort)
          if (ferr?.lat && ferr?.lng) {
            try {
              const mapsKey = await resolverGoogleApiKey(ctx.supabase, ctx.ferreteriaId)
              const coords = await geocodificarDireccion(
                direccionEntrega,
                (ferr as unknown as { nombre?: string }).nombre ?? 'Lima',
                { lat: ferr.lat, lng: ferr.lng, radiusKm: 80 },
                mapsKey,
              )
              if (coords) {
                await ctx.supabase
                  .from('pedidos')
                  .update({ cliente_lat: coords.lat, cliente_lng: coords.lng })
                  .eq('id', pedidoId)
                  .eq('ferreteria_id', ctx.ferreteriaId)
              }
            } catch (e) {
              console.warn('[crear_pedido] geocoding falló (continúa):', e)
            }
          }

          // ETA inicial + crear entrega
          const { eta, etaMinutos } = await calcularETANuevoPedido(
            ctx.supabase,
            ctx.ferreteriaId,
          )

          // Guardar eta_timestamp en pedido para lecturas rápidas
          await ctx.supabase
            .from('pedidos')
            .update({ eta_timestamp: eta.toISOString() })
            .eq('id', pedidoId)
            .eq('ferreteria_id', ctx.ferreteriaId)

          const entregaId = await crearEntrega({
            ferreteriaId: ctx.ferreteriaId,
            pedidoId,
            repartidorId: null,
            etaMinutos,
            zonaDeliveryId: zonaId,
            supabase: ctx.supabase,
          })

          if (entregaId) {
            const telefonoWA = (ferr as unknown as { telefono_whatsapp?: string }).telefono_whatsapp
            if (telefonoWA) {
              const notifCtx: DeliveryNotificationContext = {
                ferreteriaId: ctx.ferreteriaId,
                entregaId,
                pedidoId,
                numeroPedido: (pedido as unknown as { numero_pedido: string }).numero_pedido,
                nombreFerreteria: (ferr as unknown as { nombre?: string }).nombre ?? '',
                telefonoWhatsapp: telefonoWA.replace(/^\+/, ''),
                telefonoCliente: ctx.telefonoCliente,
                sender: ctx.sender,
              }
              await notificarAsignacion(notifCtx, etaMinutos, ctx.supabase, eta)
            }
          }
        } catch (e) {
          console.error('[crear_pedido] Error logística delivery:', e)
        }
      })()
    }

    return {
      ok: true,
      data: {
        numero_pedido: (pedido as unknown as { numero_pedido: string }).numero_pedido,
        total,
        modalidad,
        direccion: direccionEntrega,
        items: itemsParaPedido.map((i) => ({ nombre: i.nombre_producto, cantidad: i.cantidad })),
      },
    }
  },

  obtener_stock: async (ctx, args) => {
    requireTenant(ctx)
    const productoId = args.producto_id as string
    if (!productoId) return { ok: false, error: 'producto_id requerido' }

    const repo = new CatalogRepository(ctx.supabase)
    const data = await repo.obtenerProductoConStock(ctx.ferreteriaId, productoId)

    if (!data) return { ok: false, error: 'Producto no encontrado en esta ferretería' }
    return { ok: true, data }
  },

  consultar_pedido: async (ctx, args) => {
    requireTenant(ctx)
    const numeroPedido = (args.numero_pedido as string | undefined)?.toUpperCase()

    let query = ctx.supabase
      .from('pedidos')
      .select('numero_pedido, estado, estado_pago, modalidad, total, created_at')
      .eq('ferreteria_id', ctx.ferreteriaId)    // FERRETERÍA AISLADA
      .eq('cliente_id', ctx.clienteId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (numeroPedido) query = query.eq('numero_pedido', numeroPedido)

    const { data, error } = await query
    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) {
      return { ok: true, data: { pedidos: [], mensaje: 'Sin pedidos previos a nombre del cliente.' } }
    }
    return { ok: true, data: { pedidos: data } }
  },

  info_ferreteria: async (ctx) => {
    requireTenant(ctx)
    const [{ data: ferreteria }, { data: zonas }] = await Promise.all([
      ctx.supabase
        .from('ferreterias')
        .select('nombre, direccion, horario_apertura, horario_cierre, dias_atencion, metodos_pago_activos')
        .eq('id', ctx.ferreteriaId)              // FERRETERÍA AISLADA
        .single(),
      ctx.supabase
        .from('zonas_delivery')
        .select('nombre, tiempo_estimado_min')
        .eq('ferreteria_id', ctx.ferreteriaId)   // FERRETERÍA AISLADA
        .eq('activo', true),
    ])
    if (!ferreteria) return { ok: false, error: 'Ferretería no encontrada' }
    return { ok: true, data: { ferreteria, zonas_delivery: zonas ?? [] } }
  },

  agregar_a_pedido_reciente: async (ctx, args) => {
    requireTenant(ctx)
    const items = args.items as Array<{ nombre_buscado: string; cantidad: number }> | undefined
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'items vacío' }

    const ventanaMin = ctx.ventanaGraciaMinutos ?? 30

    const { data: pedidoRaw } = await ctx.supabase
      .from('pedidos')
      .select(
        'id, numero_pedido, total, estado, estado_pago, modalidad, created_at, ' +
        'modificaciones_count, nombre_cliente, direccion_entrega, items_pedido(*)'
      )
      .eq('ferreteria_id', ctx.ferreteriaId)    // FERRETERÍA AISLADA
      .eq('cliente_id', ctx.clienteId)
      .in('estado', ['confirmado', 'en_preparacion'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    type PedidoRaw = {
      id: string; numero_pedido: string; total: number; estado: string
      estado_pago: string | null; modalidad: string; created_at: string
      modificaciones_count: number | null; items_pedido: Array<Record<string, unknown>>
    }
    const pedido = pedidoRaw as PedidoRaw | null

    if (!pedido) return { ok: false, motivo: 'sin_pedido_editable', mensaje: 'No encontré un pedido reciente editable. Sugiere crear un pedido nuevo.' }

    const minutosTranscurridos = (Date.now() - new Date(pedido.created_at).getTime()) / 60000
    if (minutosTranscurridos > ventanaMin) {
      return { ok: false, motivo: 'fuera_de_ventana', mensaje: `El pedido ${pedido.numero_pedido} ya tiene ${Math.round(minutosTranscurridos)} min. Sugiere crear un pedido nuevo.` }
    }

    if (pedido.estado_pago === 'pagado') {
      return { ok: false, motivo: 'pedido_pagado', mensaje: `El pedido ${pedido.numero_pedido} ya fue pagado. Sugiere crear un pedido nuevo.` }
    }

    const { data: configBot } = await ctx.supabase
      .from('configuracion_bot')
      .select('umbral_monto_negociacion')
      .eq('ferreteria_id', ctx.ferreteriaId)    // FERRETERÍA AISLADA
      .single()

    const resultados = procesarItemsSolicitados(
      items,
      ctx.productos,
      (configBot as { umbral_monto_negociacion?: number } | null)?.umbral_monto_negociacion
    )

    const productoCostoMap = new Map(ctx.productos.map((p) => [p.id, p.precio_compra ?? 0]))
    const itemsActuales    = pedido.items_pedido ?? []
    const agregados: Array<{ nombre: string; cantidad: number; precio: number; subtotal: number }> = []

    for (const r of resultados) {
      if (!r.disponible || !r.producto) continue

      const existente = itemsActuales.find((i) => (i.producto_id as string) === r.producto!.id)
      if (existente) {
        const nuevaCantidad = (existente.cantidad as number) + r.cantidad
        const nuevoSubtotal = r.precio_unitario * nuevaCantidad
        await ctx.supabase.from('items_pedido').update({ cantidad: nuevaCantidad, precio_unitario: r.precio_unitario, subtotal: nuevoSubtotal }).eq('id', existente.id as string)
        agregados.push({ nombre: r.producto.nombre, cantidad: r.cantidad, precio: r.precio_unitario, subtotal: r.precio_unitario * r.cantidad })
      } else {
        await ctx.supabase.from('items_pedido').insert({
          pedido_id: pedido.id, producto_id: r.producto.id, nombre_producto: r.producto.nombre,
          unidad: r.producto.unidad, cantidad: r.cantidad, precio_unitario: r.precio_unitario,
          subtotal: r.subtotal, costo_unitario: productoCostoMap.get(r.producto.id) ?? 0,
        })
        agregados.push({ nombre: r.producto.nombre, cantidad: r.cantidad, precio: r.precio_unitario, subtotal: r.subtotal })
      }
    }

    if (agregados.length === 0) {
      return { ok: false, motivo: 'productos_no_encontrados', mensaje: 'No encontré esos productos en el catálogo. Verifica los nombres.' }
    }

    const { data: itemsFinal } = await ctx.supabase
      .from('items_pedido').select('subtotal, cantidad, costo_unitario').eq('pedido_id', pedido.id)

    const nuevoTotal  = (itemsFinal ?? []).reduce((s, i) => s + (i.subtotal as number), 0)
    const nuevoCosto  = (itemsFinal ?? []).reduce((s, i) => s + ((i.costo_unitario as number) ?? 0) * (i.cantidad as number), 0)

    await ctx.supabase.from('pedidos').update({
      total: nuevoTotal, costo_total: nuevoCosto,
      modificado_post_confirmacion_at: new Date().toISOString(),
      modificaciones_count: (pedido.modificaciones_count ?? 0) + 1,
    }).eq('id', pedido.id).eq('ferreteria_id', ctx.ferreteriaId)    // FERRETERÍA AISLADA

    try {
      await eliminarComprobantePedido(pedido.id, ctx.ferreteriaId)
      await generarYEnviarComprobante({ pedidoId: pedido.id, ferreteriaId: ctx.ferreteriaId, esProforma: false, sender: ctx.sender })
    } catch (e) { console.error('[agregar_a_pedido_reciente] Error comprobante:', e) }

    return {
      ok: true,
      data: { pedido_numero: pedido.numero_pedido, nuevo_total: nuevoTotal, items_agregados: agregados, comprobante_regenerado: true },
    }
  },

  sugerir_complementario: async (ctx, args) => {
    requireTenant(ctx)
    const productoIds = args.producto_ids as string[] | undefined
    if (!Array.isArray(productoIds) || productoIds.length === 0) return { ok: true, data: { sugerencias: [] } }

    // F5: Verificar umbral de upsell — si el monto de la cotización activa está por debajo, no sugerimos
    const umbral = ctx.umbralUpsellSoles ?? 0
    if (umbral > 0) {
      const { data: cotActiva } = await ctx.supabase
        .from('cotizaciones')
        .select('total')
        .eq('ferreteria_id', ctx.ferreteriaId)
        .eq('conversacion_id', ctx.conversacionId)
        .in('estado', ['enviada', 'pendiente_aprobacion'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (!cotActiva || (cotActiva as unknown as { total: number }).total < umbral) {
        return { ok: true, data: { sugerencias: [], motivo: 'debajo_umbral' } }
      }
    }

    // Catálogo unificado: el producto puede ser físico o digital, y el complementario
    // sugerido también puede ser de cualquiera de los dos.
    type ItemUnificado = { id: string; nombre: string; categoriaKey: string | null; precioUnitario: number; unidad: string; stock: number | null; activo: boolean }
    const fisicosPorId = new Map<string, ItemUnificado>(
      ctx.productos.map((p) => [p.id, { id: p.id, nombre: p.nombre, categoriaKey: p.categoria_id ?? null, precioUnitario: p.precio_base, unidad: p.unidad, stock: p.stock, activo: p.activo }])
    )
    const digitalesPorId = new Map<string, ItemUnificado>(
      (ctx.productosDigitales ?? []).map((p) => [p.id, { id: p.id, nombre: p.nombre, categoriaKey: p.categoria ?? null, precioUnitario: p.precio, unidad: p.unidad, stock: p.stock, activo: p.activo }])
    )
    const resolverItem = (id: string): ItemUnificado | undefined => fisicosPorId.get(id) ?? digitalesPorId.get(id)

    const productosActuales = productoIds.map(resolverItem).filter((p): p is ItemUnificado => !!p)
    const categoriasActuales = new Set(productosActuales.map((p) => p.categoriaKey).filter(Boolean))
    const tokensActuales = tokenizarProductos(productosActuales.map((p) => p.nombre))

    const { data: pares, error } = await ctx.supabase
      .from('productos_complementarios')
      .select('complementario_id, complementario_tipo, tipo, frecuencia')
      .eq('ferreteria_id', ctx.ferreteriaId)    // FERRETERÍA AISLADA
      .in('producto_id', productoIds)
      .eq('activo', true)
      .order('tipo', { ascending: false })
      .order('frecuencia', { ascending: false })

    if (error || !pares || pares.length === 0) return { ok: true, data: { sugerencias: [] } }

    const idsYaEnCotizacion = new Set(productoIds)
    const candidatos = pares.filter((p) => !idsYaEnCotizacion.has(p.complementario_id))
    if (candidatos.length === 0) return { ok: true, data: { sugerencias: [] } }

    const candidatosFiltrados = candidatos
      .map((par) => ({ par, comp: resolverItem(par.complementario_id) }))
      .filter((c): c is { par: typeof candidatos[number]; comp: ItemUnificado } =>
        !!c.comp && c.comp.activo && (c.comp.stock === null || c.comp.stock > 0)
      )
      .filter(({ par, comp }) => {
        if (par.tipo === 'manual') return true
        if (comp.categoriaKey && categoriasActuales.has(comp.categoriaKey)) return true
        const tokensComp = [...tokenizarProductos([comp.nombre])]
        return tokensComp.some((t) => tokensActuales.has(t))
      })

    if (candidatosFiltrados.length === 0) return { ok: true, data: { sugerencias: [] } }

    const ordenados = candidatosFiltrados
      .sort((a, b) => {
        if (a.par.tipo === 'manual' && b.par.tipo !== 'manual') return -1
        if (a.par.tipo !== 'manual' && b.par.tipo === 'manual') return 1
        return b.par.frecuencia - a.par.frecuencia
      })
      .slice(0, 2)

    return {
      ok: true,
      data: {
        sugerencias: ordenados.map(({ comp }) => ({
          id: comp.id, nombre: comp.nombre, precio_unitario: comp.precioUnitario, unidad: comp.unidad, stock: comp.stock,
        })),
      },
    }
  },

  historial_cliente: async (ctx) => {
    requireTenant(ctx)
    const [{ data: cliente }, { data: pedidos }] = await Promise.all([
      ctx.supabase.from('clientes').select('nombre, perfil')
        .eq('id', ctx.clienteId).eq('ferreteria_id', ctx.ferreteriaId).single(),
      ctx.supabase.from('pedidos')
        .select('numero_pedido, modalidad, total, estado, created_at, items_pedido(nombre_producto, cantidad)')
        .eq('cliente_id', ctx.clienteId).eq('ferreteria_id', ctx.ferreteriaId)
        .order('created_at', { ascending: false }).limit(5),
    ])
    return { ok: true, data: { perfil: cliente?.perfil ?? {}, nombre: cliente?.nombre ?? null, pedidos_recientes: pedidos ?? [] } }
  },

  guardar_dato_cliente: async (ctx, args) => {
    requireTenant(ctx)
    const campo  = args.campo as string
    const valor  = (args.valor as string | undefined)?.trim()
    const camposPermitidos = [
      'tipo_cliente', 'obra_actual', 'zona_habitual', 'modalidad_preferida',
      'metodo_pago_preferido', 'presupuesto_obra', 'tiene_ruc', 'giro_negocio',
    ]
    if (!campo || !camposPermitidos.includes(campo)) return { ok: false, error: 'campo no permitido' }
    if (!valor || valor.length < 2 || valor.length > 200) return { ok: false, error: 'valor inválido' }

    const { data: clienteActual } = await ctx.supabase.from('clientes').select('perfil')
      .eq('id', ctx.clienteId).eq('ferreteria_id', ctx.ferreteriaId).single()
    const perfilActual = (clienteActual?.perfil ?? {}) as Record<string, unknown>
    const perfilNuevo  = { ...perfilActual, [campo]: valor }

    const { error } = await ctx.supabase.from('clientes').update({ perfil: perfilNuevo })
      .eq('id', ctx.clienteId).eq('ferreteria_id', ctx.ferreteriaId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { guardado: { [campo]: valor } } }
  },

  escalar_humano: async (ctx, args) => {
    requireTenant(ctx)
    const razon = (args.razon as string) || 'solicitud del cliente'
    await pausarBot(ctx.supabase, ctx.conversacionId)
    console.log(`[Orchestrator] escalar_humano conv=${ctx.conversacionId} razón="${razon}"`)
    return { ok: true, data: { pausado: true, razon } }
  },

  // ── Solicitar comprobante ──────────────────────────────────────────────────
  solicitar_comprobante: async (ctx, args) => {
    requireTenant(ctx)

    const numeroPedidoArg   = ((args.numero_pedido as string | undefined) ?? '').toUpperCase().trim() || null
    const tipoComprobanteArg = (args.tipo_comprobante as 'boleta' | 'factura' | undefined) ?? null
    const rucClienteArg      = ((args.ruc_cliente as string | undefined) ?? '').replace(/\D/g, '') || null

    // Fetch ferreteria config (tipo_ruc, nubefact, telefono_whatsapp)
    const { data: ferreteria } = await ctx.supabase
      .from('ferreterias')
      .select('tipo_ruc, nubefact_ruta, nubefact_token_enc, telefono_whatsapp')
      .eq('id', ctx.ferreteriaId)
      .single()

    if (!ferreteria) return { ok: false, error: 'Ferretería no encontrada' }

    type FerrConfig = { tipo_ruc?: string; nubefact_ruta?: string; nubefact_token_enc?: string; telefono_whatsapp?: string }
    const ferr = ferreteria as unknown as FerrConfig
    const tipoRucTenant      = ferr.tipo_ruc ?? 'sin_ruc'
    const nubefactConfigurado = !!(ferr.nubefact_ruta && ferr.nubefact_token_enc)
    const telefonoWA          = ferr.telefono_whatsapp ?? null

    // Validar RUC si el cliente lo proporcionó y el tenant puede emitir facturas
    if (tipoRucTenant === 'ruc20' && rucClienteArg) {
      if (!validarFormatoRuc(rucClienteArg)) {
        return {
          ok: false,
          error: `El RUC ${rucClienteArg} tiene formato inválido. Debe ser 11 dígitos comenzando con 10 o 20.`,
          motivo: 'ruc_invalido',
        }
      }
      let consultaRuc: Awaited<ReturnType<typeof consultarRuc>>
      try {
        // SUNAT API tiene latencia variable — timeout de 5s para no bloquear el orquestador
        consultaRuc = await withTimeout(5_000, consultarRuc(rucClienteArg))
      } catch (eRuc) {
        const esTimeout = eRuc instanceof Error && eRuc.message.startsWith('timeout_')
        return {
          ok: false,
          error: esTimeout
            ? `La consulta a SUNAT tardó demasiado. Puedes continuar sin validar el RUC o intentar más tarde.`
            : `Error consultando SUNAT: ${eRuc instanceof Error ? eRuc.message : String(eRuc)}`,
          motivo: 'ruc_timeout',
        }
      }
      if (!consultaRuc.ok || !consultaRuc.data) {
        return {
          ok: false,
          error: `No se pudo verificar el RUC ${rucClienteArg} en SUNAT (${consultaRuc.error ?? 'no encontrado'}). Pide al cliente que lo confirme.`,
          motivo: 'ruc_no_encontrado',
        }
      }
      const infoRuc = consultaRuc.data
      // Guardar RUC en el registro del cliente — FERRETERÍA AISLADA
      await ctx.supabase
        .from('clientes')
        .update({ ruc_cliente: rucClienteArg, tipo_persona: infoRuc.tipoPersona })
        .eq('id', ctx.clienteId)
        .eq('ferreteria_id', ctx.ferreteriaId)

      if (!infoRuc.activo) {
        return {
          ok: false,
          error: `El RUC ${rucClienteArg} (${infoRuc.razonSocial}) figura como ${infoRuc.estado}/${infoRuc.condicion} en SUNAT. Informa al cliente y pregunta si desea continuar o prefiere nota de venta.`,
          motivo: 'ruc_inactivo',
        }
      }
    }

    // Buscar pedidos del cliente — FERRETERÍA AISLADA
    const { data: pedidos } = await ctx.supabase
      .from('pedidos')
      .select('id, numero_pedido, estado, estado_pago, nombre_cliente, created_at')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('cliente_id', ctx.clienteId)
      .in('estado', ['pendiente', 'confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado', 'entregado'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (!pedidos || pedidos.length === 0) {
      return { ok: false, error: 'No encontré pedidos para este cliente. ¿Quizás fue registrado con otro número?', motivo: 'sin_pedidos' }
    }

    // Si el cliente tiene múltiples pedidos y no especificó cuál
    if (pedidos.length > 1 && !numeroPedidoArg) {
      return {
        ok: false,
        motivo: 'multiples_pedidos',
        error: 'El cliente tiene varios pedidos. Pregúntale de cuál necesita el comprobante.',
        data: { pedidos: pedidos.slice(0, 3).map((p) => ({ numero_pedido: p.numero_pedido, estado: p.estado })) },
      }
    }

    // Seleccionar pedido objetivo
    let pedidoTarget = pedidos[0]
    if (numeroPedidoArg) {
      const match = pedidos.find((p) => p.numero_pedido.toUpperCase() === numeroPedidoArg)
      if (match) pedidoTarget = match
    }

    type PedidoTarget = { id: string; numero_pedido: string; estado: string; estado_pago: string | null; nombre_cliente: string | null }
    const ped = pedidoTarget as unknown as PedidoTarget

    const pagado        = ped.estado_pago === 'pagado'
    const pidioFactura  = tipoComprobanteArg === 'factura' || !!rucClienteArg

    // ── Caso 1: no pagado → nota de venta / proforma ───────────────────────
    if (!pagado) {
      const esProforma = ped.estado === 'pendiente'
      const resultadoNV = await generarYEnviarComprobante({
        pedidoId:     ped.id,
        ferreteriaId: ctx.ferreteriaId,
        esProforma,
        sender: ctx.sender,
      })
      if (!resultadoNV.ok) {
        return { ok: false, error: resultadoNV.error ?? 'Error generando documento' }
      }
      return {
        ok: true,
        data: {
          tipo_documento:     esProforma ? 'proforma' : 'nota_venta',
          numero_comprobante: resultadoNV.numero_comprobante,
          pedido_numero:      ped.numero_pedido,
          enviado:            true,
          nota: pidioFactura
            ? `Para emitir comprobante electrónico primero se necesita completar el pago.`
            : undefined,
        },
      }
    }

    // ── Caso 2: pagado pero sin Nubefact o sin_ruc → nota de venta ─────────
    if (!nubefactConfigurado || tipoRucTenant === 'sin_ruc') {
      const resultadoNV = await generarYEnviarComprobante({
        pedidoId:     ped.id,
        ferreteriaId: ctx.ferreteriaId,
        esProforma:   false,
        sender: ctx.sender,
      })
      if (!resultadoNV.ok) {
        return { ok: false, error: resultadoNV.error ?? 'Error generando documento' }
      }
      return {
        ok: true,
        data: {
          tipo_documento:     'nota_venta',
          numero_comprobante: resultadoNV.numero_comprobante,
          pedido_numero:      ped.numero_pedido,
          enviado:            true,
        },
      }
    }

    // ── Caso 3: pagado + Nubefact → boleta o factura electrónica ───────────
    if (pidioFactura) {
      // Buscar RUC guardado si no se proporcionó
      let rucParaFactura = rucClienteArg ?? ''
      if (!rucParaFactura) {
        const { data: clienteData } = await ctx.supabase
          .from('clientes')
          .select('ruc_cliente')
          .eq('id', ctx.clienteId)
          .eq('ferreteria_id', ctx.ferreteriaId)
          .single()
        rucParaFactura = (clienteData as unknown as { ruc_cliente?: string } | null)?.ruc_cliente ?? ''
      }

      if (!rucParaFactura || rucParaFactura.length !== 11) {
        return {
          ok: false,
          motivo: 'falta_ruc_factura',
          error: 'Para emitir factura electrónica necesito el RUC del cliente (11 dígitos). Pídelo explícitamente y vuelve a llamar esta tool con el RUC.',
        }
      }

      const resultFact = await emitirFactura({
        supabase:      ctx.supabase,
        pedidoId:      ped.id,
        ferreteriaId:  ctx.ferreteriaId,
        clienteNombre: ped.nombre_cliente || 'CLIENTE',
        clienteRuc:    rucParaFactura,
        emitidoPor:    'bot',
        tokenPlano:    ctx.nubefactTokenPlano || '',
      })

      if (resultFact.ok && resultFact.pdfUrl && ctx.sender) {
        ctx.sender.enviarDocumento({
          to:       ctx.telefonoCliente,
          pdfUrl:   resultFact.pdfUrl,
          filename: `${resultFact.numeroCompleto ?? 'factura'}.pdf`,
          caption:  `Factura ${resultFact.numeroCompleto} — Pedido ${ped.numero_pedido}`,
        }).catch((e) => console.error('[solicitar_comprobante] Error enviando factura:', e))

        return {
          ok: true,
          data: {
            tipo_documento:     'factura',
            numero_comprobante: resultFact.numeroCompleto,
            pedido_numero:      ped.numero_pedido,
            enviado:            true,
          },
        }
      } else if (resultFact.tokenInvalido) {
        return { ok: false, error: 'Token Nubefact inválido. El encargado enviará el comprobante directamente.', motivo: 'nubefact_token_invalido' }
      } else {
        return { ok: false, error: resultFact.error ?? 'Error emitiendo factura', motivo: 'error_nubefact' }
      }
    }

    // Emitir boleta electrónica (caso default)
    const resultBol = await emitirBoleta({
      supabase:      ctx.supabase,
      pedidoId:      ped.id,
      ferreteriaId:  ctx.ferreteriaId,
      tipoBoleta:    'boleta',
      clienteNombre: ped.nombre_cliente || 'CLIENTES VARIOS',
      clienteDni:    '',
      emitidoPor:    'bot',
      tokenPlano:    ctx.nubefactTokenPlano || '',
    })

    if (resultBol.ok && resultBol.pdfUrl && ctx.sender) {
      ctx.sender.enviarDocumento({
        to:       ctx.telefonoCliente,
        pdfUrl:   resultBol.pdfUrl,
        filename: `${resultBol.numeroCompleto ?? 'boleta'}.pdf`,
        caption:  `Boleta ${resultBol.numeroCompleto} — Pedido ${ped.numero_pedido}`,
      }).catch((e) => console.error('[solicitar_comprobante] Error enviando boleta:', e))

      return {
        ok: true,
        data: {
          tipo_documento:     'boleta',
          numero_comprobante: resultBol.numeroCompleto,
          pedido_numero:      ped.numero_pedido,
          enviado:            true,
        },
      }
    } else if (resultBol.tokenInvalido) {
      // Fallback a nota de venta
      const resultNV = await generarYEnviarComprobante({
        pedidoId: ped.id, ferreteriaId: ctx.ferreteriaId, sender: ctx.sender,
      })
      if (resultNV.ok) {
        return {
          ok: true,
          data: {
            tipo_documento:     'nota_venta',
            numero_comprobante: resultNV.numero_comprobante,
            pedido_numero:      ped.numero_pedido,
            enviado:            true,
            nota:               'Boleta electrónica temporalmente no disponible — se envió nota de venta',
          },
        }
      }
      return { ok: false, error: 'Error generando documento de respaldo', motivo: 'error_fallback' }
    } else {
      return { ok: false, error: resultBol.error ?? 'Error emitiendo boleta', motivo: 'error_nubefact' }
    }
  },

  // ── Generar PDF de cotización activa ──────────────────────────────────────
  generar_cotizacion_pdf: async (ctx, args) => {
    requireTenant(ctx)

    const cotizacionId = (ctx.datosFlujo?.cotizacion_id as string | undefined)
    if (!cotizacionId) {
      return {
        ok: false,
        error: 'No hay cotización activa. Primero usa buscar_producto y guardar_cotizacion.',
        motivo: 'sin_cotizacion',
      }
    }

    const nombreCliente = (args.nombre_cliente as string | undefined)?.trim() || undefined

    const resultado = await generarYEnviarCotizacionPDF({
      cotizacionId,
      ferreteriaId:    ctx.ferreteriaId,
      telefonoCliente: ctx.telefonoCliente,
      nombreCliente,
      sender:          ctx.sender,
    })

    if (!resultado.ok) {
      return { ok: false, error: resultado.error ?? 'Error generando PDF de cotización' }
    }

    return {
      ok: true,
      data: {
        numero_cotizacion: resultado.numero_comprobante,
        pdf_url:           resultado.pdf_url,
        enviado:           resultado.enviado ?? false,
      },
    }
  },

  // ── Modificar pedido pendiente ─────────────────────────────────────────────
  modificar_pedido: async (ctx, args) => {
    requireTenant(ctx)

    const items = args.items as Array<{ nombre_buscado: string; cantidad: number }> | undefined
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, error: 'items vacío — debes indicar qué productos modificar y con qué cantidad (0 = quitar)' }
    }

    // Buscar pedido pendiente más reciente del cliente — FERRETERÍA AISLADA
    const { data: pedidoRaw } = await ctx.supabase
      .from('pedidos')
      .select('id, numero_pedido, total, items_pedido(*)')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('cliente_id', ctx.clienteId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pedidoRaw) {
      return {
        ok: false,
        motivo: 'sin_pedido_pendiente',
        error: 'No hay pedido pendiente para modificar. Si el pedido ya fue confirmado usa agregar_a_pedido_reciente.',
      }
    }

    type PedidoMod = { id: string; numero_pedido: string; total: number; items_pedido: Array<Record<string, unknown>> }
    const pedido      = pedidoRaw as unknown as PedidoMod
    const itemsActuales = pedido.items_pedido ?? []
    const productoCostoMap = new Map(ctx.productos.map((p) => [p.id, p.precio_compra ?? 0]))

    // ── Quitar items (cantidad = 0) ──────────────────────────────────────────
    const itemsQuitar = items.filter((i) => i.cantidad === 0)
    for (const req of itemsQuitar) {
      const nombre = req.nombre_buscado.toLowerCase()
      const match = itemsActuales.find((ia) => {
        const nombreProd = (ia.nombre_producto as string).toLowerCase()
        return nombreProd.includes(nombre) || nombre.includes(nombreProd.split(' ')[0])
      })
      if (match) {
        await ctx.supabase.from('items_pedido').delete().eq('id', match.id as string)
      }
    }

    // ── Agregar / actualizar items (cantidad > 0) ────────────────────────────
    const itemsModificar = items.filter((i) => i.cantidad > 0)
    if (itemsModificar.length > 0) {
      const { data: configBot } = await ctx.supabase
        .from('configuracion_bot')
        .select('umbral_monto_negociacion')
        .eq('ferreteria_id', ctx.ferreteriaId)
        .single()

      const resultados = procesarItemsSolicitados(
        itemsModificar,
        ctx.productos,
        (configBot as { umbral_monto_negociacion?: number } | null)?.umbral_monto_negociacion
      )

      for (const r of resultados) {
        if (!r.disponible || !r.producto) continue

        const existente = itemsActuales.find((ia) => (ia.producto_id as string) === r.producto!.id)
        if (existente) {
          await ctx.supabase
            .from('items_pedido')
            .update({
              cantidad:        r.cantidad,
              precio_unitario: r.precio_unitario,
              subtotal:        r.subtotal,
              costo_unitario:  productoCostoMap.get(r.producto.id) ?? 0,
            })
            .eq('id', existente.id as string)
        } else {
          await ctx.supabase.from('items_pedido').insert({
            pedido_id:       pedido.id,
            producto_id:     r.producto.id,
            nombre_producto: r.producto.nombre,
            unidad:          r.producto.unidad,
            cantidad:        r.cantidad,
            precio_unitario: r.precio_unitario,
            subtotal:        r.subtotal,
            costo_unitario:  productoCostoMap.get(r.producto.id) ?? 0,
          })
        }
      }
    }

    // ── Recalcular total ─────────────────────────────────────────────────────
    const { data: itemsFinal } = await ctx.supabase
      .from('items_pedido')
      .select('subtotal, cantidad, costo_unitario')
      .eq('pedido_id', pedido.id)

    if (!itemsFinal || itemsFinal.length === 0) {
      return {
        ok: true,
        data: {
          pedido_numero: pedido.numero_pedido,
          nuevo_total:   0,
          vaciado:       true,
          mensaje:       'El pedido quedó sin productos. Pregunta al cliente si desea cancelarlo o agregar otros productos.',
        },
      }
    }

    const nuevoTotal = itemsFinal.reduce((s, i) => s + (i.subtotal as number), 0)
    const nuevoCosto = itemsFinal.reduce((s, i) => s + ((i.costo_unitario as number) ?? 0) * (i.cantidad as number), 0)

    await ctx.supabase
      .from('pedidos')
      .update({ total: nuevoTotal, costo_total: nuevoCosto })
      .eq('id', pedido.id)
      .eq('ferreteria_id', ctx.ferreteriaId)     // FERRETERÍA AISLADA

    // Borrar comprobante anterior si existe (el cliente podrá pedirlo actualizado)
    try { await eliminarComprobantePedido(pedido.id, ctx.ferreteriaId) } catch (_) { /* no-op */ }

    // Devolver lista actualizada al LLM
    const { data: itemsMostrar } = await ctx.supabase
      .from('items_pedido')
      .select('nombre_producto, cantidad, precio_unitario')
      .eq('pedido_id', pedido.id)
      .order('nombre_producto')

    return {
      ok: true,
      data: {
        pedido_numero: pedido.numero_pedido,
        nuevo_total:   nuevoTotal,
        items: (itemsMostrar ?? []).map((i) => ({
          nombre:   i.nombre_producto,
          cantidad: i.cantidad,
          precio:   (i.precio_unitario as number).toFixed(2),
        })),
      },
    }
  },

  // ── Notificación a canal Telegram ────────────────────────────────────────
  notificar_telegram: async (ctx, args) => {
    requireTenant(ctx)

    const mensaje = (args.mensaje as string | undefined)?.trim()
    if (!mensaje) return { ok: false, error: 'mensaje es requerido' }

    // Obtener credenciales Telegram del tenant
    const { data: ferr } = await ctx.supabase
      .from('ferreterias')
      .select('nombre, telegram_bot_token, telegram_chat_id')
      .eq('id', ctx.ferreteriaId)
      .single()

    const botToken = (ferr as unknown as { telegram_bot_token?: string | null })?.telegram_bot_token
    const chatId   = (ferr as unknown as { telegram_chat_id?:   string | null })?.telegram_chat_id
    const nombre   = (ferr as unknown as { nombre?: string })?.nombre ?? 'Ferretería'

    if (!botToken || !chatId) {
      return { ok: false, error: 'Telegram no configurado', motivo: 'sin_integracion' }
    }

    const texto = `📢 *${nombre}* — FerroBot\n\n${mensaje}`
    const resultado = await enviarMensajeTelegram({ botToken, chatId, texto })

    if (!resultado.ok) {
      return { ok: false, error: resultado.error ?? 'Error enviando a Telegram' }
    }

    return { ok: true, data: { enviado: true } }
  },

  // ── Enviar cotización por email (Resend) ──────────────────────────────────
  enviar_cotizacion_email: async (ctx, args) => {
    requireTenant(ctx)

    const emailCliente  = (args.email_cliente  as string | undefined)?.trim()
    const cotizacionId  = (args.cotizacion_id  as string | undefined)?.trim()

    if (!emailCliente || !/^[^@]+@[^@]+\.[^@]+$/.test(emailCliente)) {
      return { ok: false, error: 'email_cliente inválido' }
    }

    const { data: ferr } = await ctx.supabase
      .from('ferreterias')
      .select('nombre, resend_api_key, resend_from_email')
      .eq('id', ctx.ferreteriaId)
      .single()

    const apiKey    = (ferr as any)?.resend_api_key    as string | null
    const fromEmail = (ferr as any)?.resend_from_email as string | null
    const nombre    = (ferr as any)?.nombre ?? 'Ferretería'

    if (!apiKey || !fromEmail) {
      return { ok: false, error: 'Resend no configurado', motivo: 'sin_integracion' }
    }

    // Obtener la cotización (usa la pasada o la más reciente de la conversación)
    let pdfUrl: string | null = null
    let cotNumero = ''
    if (cotizacionId) {
      const { data: cot } = await ctx.supabase
        .from('cotizaciones')
        .select('numero_cotizacion')
        .eq('id', cotizacionId)
        .eq('ferreteria_id', ctx.ferreteriaId)
        .single()
      cotNumero = (cot as any)?.numero_cotizacion ?? ''
    } else {
      const { data: conv } = await ctx.supabase
        .from('conversaciones')
        .select('cotizacion_activa_id')
        .eq('ferreteria_id', ctx.ferreteriaId)
        .eq('numero_whatsapp', ctx.telefonoCliente)
        .single()
      const cidActivo = (conv as any)?.cotizacion_activa_id as string | null
      if (!cidActivo) return { ok: false, error: 'No hay cotización activa en la conversación' }
      // Generar PDF y obtener URL
      const { generarYEnviarCotizacionPDF: gen } = await import('@/lib/pdf/generar-comprobante')
      const res = await gen({
        cotizacionId:   cidActivo,
        ferreteriaId:   ctx.ferreteriaId,
        telefonoCliente: ctx.telefonoCliente,
        sender:          ctx.sender,
      })
      if (!res.ok) return { ok: false, error: res.error }
      pdfUrl     = res.pdf_url ?? null
      cotNumero  = res.numero_comprobante ?? ''
    }

    const subject = `📋 Cotización ${cotNumero} — ${nombre}`
    const html    = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#1e40af">Cotización ${cotNumero}</h2>
        <p>Hola,</p>
        <p>Adjuntamos tu cotización de <strong>${nombre}</strong>.</p>
        ${pdfUrl ? `<p><a href="${pdfUrl}" style="background:#1e40af;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Ver PDF de cotización</a></p>` : ''}
        <p style="color:#666;font-size:12px">Este email fue enviado automáticamente por FerroBot.</p>
      </div>`

    const resultado = await enviarEmail({ apiKey, from: `${nombre} <${fromEmail}>`, to: emailCliente, subject, html })
    if (!resultado.ok) return { ok: false, error: resultado.error }

    return { ok: true, data: { enviado: true, email: emailCliente, cotizacion: cotNumero } }
  },

  // ── Notificar nuevo pedido por email (Resend) ─────────────────────────────
  notificar_pedido_email: async (ctx, args) => {
    requireTenant(ctx)

    const pedidoNumero = (args.pedido_numero as string | undefined)?.trim()
    const resumen      = (args.resumen       as string | undefined)?.trim()

    if (!pedidoNumero) return { ok: false, error: 'pedido_numero es requerido' }

    const { data: ferr } = await ctx.supabase
      .from('ferreterias')
      .select('nombre, resend_api_key, resend_from_email')
      .eq('id', ctx.ferreteriaId)
      .single()

    const apiKey    = (ferr as any)?.resend_api_key    as string | null
    const fromEmail = (ferr as any)?.resend_from_email as string | null
    const nombre    = (ferr as any)?.nombre ?? 'Ferretería'

    if (!apiKey || !fromEmail) {
      return { ok: false, error: 'Resend no configurado', motivo: 'sin_integracion' }
    }

    const subject = `🛒 Nuevo pedido ${pedidoNumero} — ${nombre}`
    const html    = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#059669">Nuevo pedido recibido</h2>
        <p><strong>Pedido:</strong> ${pedidoNumero}</p>
        <p>${resumen ?? ''}</p>
        <p style="color:#666;font-size:12px">FerroBot — ${nombre}</p>
      </div>`

    const resultado = await enviarEmail({ apiKey, from: `${nombre} <${fromEmail}>`, to: fromEmail, subject, html })
    if (!resultado.ok) return { ok: false, error: resultado.error }

    return { ok: true, data: { enviado: true } }
  },

  // ── Helper interno: obtiene tokens Google del tenant ─────────────────────
  // (se reutiliza en todos los executors de Google)

  // ── Aplicar descuento a cotización activa ─────────────────────────────────
  aplicar_descuento: async (ctx, args) => {
    requireTenant(ctx)
    const tipo  = (args.tipo  as 'porcentaje' | 'fijo')
    const valor = args.valor  as number
    const motivo = (args.motivo as string | undefined) ?? ''

    if (!['porcentaje', 'fijo'].includes(tipo)) return { ok: false, error: 'tipo inválido' }
    if (typeof valor !== 'number' || valor <= 0) return { ok: false, error: 'valor inválido' }

    // Buscar cotización activa de la conversación
    const { data: conv } = await ctx.supabase
      .from('conversaciones')
      .select('cotizacion_activa_id')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('numero_whatsapp', ctx.telefonoCliente)
      .single()

    const cotId = (conv as any)?.cotizacion_activa_id
    if (!cotId) return { ok: false, error: 'No hay cotización activa' }

    const { data: cot } = await ctx.supabase
      .from('cotizaciones')
      .select('id, total, descuento_aplicado')
      .eq('id', cotId)
      .eq('ferreteria_id', ctx.ferreteriaId)
      .single()

    if (!cot) return { ok: false, error: 'Cotización no encontrada' }

    const total = cot.total as number
    const descuento = tipo === 'porcentaje'
      ? Math.min(total, total * (valor / 100))
      : Math.min(total, valor)

    const nuevoTotal = Math.max(0, total - descuento)

    await ctx.supabase
      .from('cotizaciones')
      .update({
        descuento_aplicado: descuento,
        total: nuevoTotal,
        ...(motivo ? { notas: motivo } : {}),
      })
      .eq('id', cotId)

    return {
      ok: true,
      data: {
        descuento_aplicado: descuento.toFixed(2),
        nuevo_total:        nuevoTotal.toFixed(2),
        tipo,
        valor,
      },
    }
  },

  // ── Generar link de cobro MercadoPago ─────────────────────────────────────
  generar_link_cobro_mp: async (ctx, args) => {
    requireTenant(ctx)
    const montoSoles = args.monto_soles as number
    const descripcion = (args.descripcion as string | undefined)?.trim() ?? 'Pedido FerroBot'

    if (!montoSoles || montoSoles <= 0) return { ok: false, error: 'monto_soles inválido' }

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'mercadopago')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'MercadoPago no conectado', motivo: 'sin_integracion' }
    }

    const accessToken = (integ.metadata as any)?.access_token as string | null
    if (!accessToken) return { ok: false, error: 'Access token de MercadoPago no disponible' }

    const { data: ferr } = await ctx.supabase
      .from('ferreterias')
      .select('nombre')
      .eq('id', ctx.ferreteriaId)
      .single()

    const nombre = (ferr as any)?.nombre ?? 'Ferretería'

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          title:     descripcion,
          quantity:  1,
          unit_price: montoSoles,
          currency_id: 'PEN',
        }],
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL}/pago/gracias`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL}/pago/error`,
        },
        statement_descriptor: nombre.slice(0, 22),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: (err as any)?.message ?? `MP error ${res.status}` }
    }

    const pref = await res.json()
    return {
      ok: true,
      data: {
        preference_id: pref.id,
        link_pago:     pref.init_point,
        monto_soles:   montoSoles,
      },
    }
  },

  // ── Consultar deuda del cliente ────────────────────────────────────────────
  consultar_deuda_cliente: async (ctx, args) => {
    requireTenant(ctx)
    const limite = Math.min(20, (args.limite as number | undefined) ?? 5)

    const { data: pedidos } = await ctx.supabase
      .from('pedidos')
      .select('numero_pedido, total, estado, created_at')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('numero_whatsapp_cliente', ctx.telefonoCliente)
      .in('estado', ['pendiente', 'confirmado', 'en_preparacion', 'listo'])
      .order('created_at', { ascending: false })
      .limit(limite)

    const items = (pedidos ?? []) as Array<{
      numero_pedido: string
      total: number
      estado: string
      created_at: string
    }>

    const totalDeuda = items.reduce((sum, p) => sum + (p.total ?? 0), 0)

    return {
      ok: true,
      data: {
        pedidos_pendientes: items.map((p) => ({
          numero: p.numero_pedido,
          total:  `S/ ${(p.total ?? 0).toFixed(2)}`,
          estado: p.estado,
        })),
        total_adeudado: `S/ ${totalDeuda.toFixed(2)}`,
        cantidad: items.length,
      },
    }
  },

  // ── Registrar email del cliente ────────────────────────────────────────────
  registrar_email_cliente: async (ctx, args) => {
    requireTenant(ctx)
    const email = (args.email as string | undefined)?.trim()
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return { ok: false, error: 'Email inválido' }
    }

    await ctx.supabase
      .from('clientes')
      .update({ email })
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('numero_whatsapp', ctx.telefonoCliente)

    return { ok: true, data: { email_guardado: email } }
  },

  // ── Gmail: enviar email ────────────────────────────────────────────────────
  enviar_email_gmail: async (ctx, args) => {
    requireTenant(ctx)
    const emailDestino = (args.email_destino as string | undefined)?.trim()
    const asunto       = (args.asunto       as string | undefined)?.trim()
    const cuerpoHtml   = (args.cuerpo_html  as string | undefined)?.trim()

    if (!emailDestino || !asunto || !cuerpoHtml) {
      return { ok: false, error: 'email_destino, asunto y cuerpo_html son requeridos' }
    }

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'google')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'Google no conectado', motivo: 'sin_integracion' }
    }

    const tokens = integ.metadata as any
    const { accessToken } = await getValidAccessToken(tokens)

    const { data: ferr } = await ctx.supabase
      .from('ferreterias')
      .select('nombre')
      .eq('id', ctx.ferreteriaId)
      .single()
    const nombre = (ferr as any)?.nombre ?? 'Ferretería'

    const res = await enviarEmailGmail({
      accessToken,
      from:      `${nombre} <${tokens.email}>`,
      to:        emailDestino,
      subject:   asunto,
      html:      cuerpoHtml,
    })

    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, data: { enviado: true, para: emailDestino } }
  },

  // ── Recordatorio de pago ───────────────────────────────────────────────────
  enviar_recordatorio_pago: async (ctx, args) => {
    requireTenant(ctx)
    const emailCliente = (args.email_cliente as string | undefined)?.trim()
    const pedidos      = (args.pedidos      as string | undefined)?.trim()
    const totalSoles   = args.total_soles   as number

    if (!emailCliente || !pedidos) return { ok: false, error: 'email_cliente y pedidos son requeridos' }

    const { data: ferr } = await ctx.supabase
      .from('ferreterias')
      .select('nombre, resend_api_key, resend_from_email')
      .eq('id', ctx.ferreteriaId)
      .single()

    const nombre    = (ferr as any)?.nombre           ?? 'Ferretería'
    const apiKey    = (ferr as any)?.resend_api_key   as string | null
    const fromEmail = (ferr as any)?.resend_from_email as string | null

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#dc2626">Recordatorio de pago pendiente</h2>
        <p>Hola, te recordamos que tienes pagos pendientes con <strong>${nombre}</strong>:</p>
        <p style="background:#fef2f2;padding:12px;border-radius:8px;">${pedidos}</p>
        <p><strong>Total adeudado: S/ ${(totalSoles ?? 0).toFixed(2)}</strong></p>
        <p>Para consultas, escríbenos por WhatsApp. ¡Gracias!</p>
        <p style="color:#666;font-size:12px">FerroBot — ${nombre}</p>
      </div>`

    if (apiKey && fromEmail) {
      const res = await enviarEmail({ apiKey, from: `${nombre} <${fromEmail}>`, to: emailCliente, subject: `Recordatorio de pago — ${nombre}`, html })
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, data: { enviado: true, via: 'resend' } }
    }

    // Fallback: Gmail si está conectado
    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'google')
      .single()

    if (integ?.estado === 'conectado') {
      const tokens = integ.metadata as any
      const { accessToken } = await getValidAccessToken(tokens)
      const res = await enviarEmailGmail({
        accessToken,
        from:    `${nombre} <${tokens.email}>`,
        to:      emailCliente,
        subject: `Recordatorio de pago — ${nombre}`,
        html,
      })
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, data: { enviado: true, via: 'gmail' } }
    }

    return { ok: false, error: 'Ningún servicio de email configurado', motivo: 'sin_integracion' }
  },

  // ── Telegram: alerta stock bajo ────────────────────────────────────────────
  notificar_stock_bajo_telegram: async (ctx, args) => {
    requireTenant(ctx)
    const productos = (args.productos as string | undefined)?.trim()
    if (!productos) return { ok: false, error: 'productos es requerido' }

    const { data: ferr } = await ctx.supabase
      .from('ferreterias')
      .select('nombre, telegram_bot_token, telegram_chat_id')
      .eq('id', ctx.ferreteriaId)
      .single()

    const botToken = (ferr as any)?.telegram_bot_token as string | null
    const chatId   = (ferr as any)?.telegram_chat_id   as string | null
    const nombre   = (ferr as any)?.nombre ?? 'Ferretería'

    if (!botToken || !chatId) return { ok: false, error: 'Telegram no configurado', motivo: 'sin_integracion' }

    const texto = `⚠️ *${nombre}* — Stock bajo\n\n${productos}`
    const res = await enviarMensajeTelegram({ botToken, chatId, texto })
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, data: { enviado: true } }
  },

  // ── Drive: guardar comprobante ─────────────────────────────────────────────
  guardar_comprobante_drive: async (ctx, args) => {
    requireTenant(ctx)
    const pdfUrl  = (args.pdf_url as string | undefined)?.trim()
    const nombre  = (args.nombre  as string | undefined)?.trim()
    const tipo    = (args.tipo    as string | undefined)?.trim() ?? 'documento'

    if (!pdfUrl || !nombre) return { ok: false, error: 'pdf_url y nombre son requeridos' }

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'google')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'Google Drive no conectado', motivo: 'sin_integracion' }
    }

    const tokens = integ.metadata as any
    const { accessToken } = await getValidAccessToken(tokens)

    // Descargar PDF
    const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(20_000) })
    if (!pdfRes.ok) return { ok: false, error: 'No se pudo descargar el PDF' }
    const pdfArrayBuffer = await pdfRes.arrayBuffer()

    const folderId = await obtenerOCrearCarpetaFerroBot(accessToken)

    const res = await subirArchivoaDrive({
      accessToken,
      nombre:   `${nombre}.pdf`,
      mimeType: 'application/pdf',
      contenido: pdfArrayBuffer,
      folderId:  folderId ?? undefined,
    })

    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, data: { file_id: res.fileId, link: res.webLink, tipo } }
  },

  // ── Calendar: crear evento de entrega ─────────────────────────────────────
  crear_evento_entrega: async (ctx, args) => {
    requireTenant(ctx)
    const titulo     = (args.titulo      as string | undefined)?.trim()
    const inicio     = (args.fecha_hora_inicio as string | undefined)?.trim()
    const fin        = (args.fecha_hora_fin    as string | undefined)?.trim()
    const descripcion = (args.descripcion as string | undefined)?.trim()
    const emailCli   = (args.email_cliente as string | undefined)?.trim()

    if (!titulo || !inicio || !fin) return { ok: false, error: 'titulo, fecha_hora_inicio y fecha_hora_fin son requeridos' }

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'google')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'Google Calendar no conectado', motivo: 'sin_integracion' }
    }

    const tokens = integ.metadata as any
    const { accessToken } = await getValidAccessToken(tokens)

    const res = await crearEventoCalendario(accessToken, {
      summary:     titulo,
      description: descripcion,
      startIso:    inicio,
      endIso:      fin,
      calendarId:  tokens.calendar_id ?? 'primary',
      attendees:   emailCli ? [emailCli] : [],
    })

    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, data: { event_id: res.eventId, link: res.link } }
  },

  // ── Calendar: agendar visita técnica ──────────────────────────────────────
  agendar_visita_tecnica: async (ctx, args) => {
    requireTenant(ctx)
    const titulo     = (args.titulo      as string | undefined)?.trim()
    const inicio     = (args.fecha_hora_inicio as string | undefined)?.trim()
    const fin        = (args.fecha_hora_fin    as string | undefined)?.trim()
    const descripcion = (args.descripcion as string | undefined)?.trim()
    const emailCli   = (args.email_cliente as string | undefined)?.trim()

    if (!titulo || !inicio || !fin) return { ok: false, error: 'titulo, fecha_hora_inicio y fecha_hora_fin son requeridos' }

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'google')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'Google Calendar no conectado', motivo: 'sin_integracion' }
    }

    const tokens = integ.metadata as any
    const { accessToken } = await getValidAccessToken(tokens)

    const res = await crearEventoCalendario(accessToken, {
      summary:     `🔧 ${titulo}`,
      description: descripcion,
      startIso:    inicio,
      endIso:      fin,
      calendarId:  tokens.calendar_id ?? 'primary',
      attendees:   emailCli ? [emailCli] : [],
    })

    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, data: { event_id: res.eventId, link: res.link } }
  },

  // ── Calendar: consultar agenda de hoy ─────────────────────────────────────
  consultar_agenda_hoy: async (ctx) => {
    requireTenant(ctx)

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'google')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'Google Calendar no conectado', motivo: 'sin_integracion' }
    }

    const tokens = integ.metadata as any
    const { accessToken } = await getValidAccessToken(tokens)

    const res = await listarEventosHoy(accessToken, tokens.calendar_id ?? 'primary')
    if (!res.ok) return { ok: false, error: res.error }

    return {
      ok: true,
      data: {
        eventos: res.eventos ?? [],
        total:   (res.eventos ?? []).length,
      },
    }
  },

  // ── MercadoPago: verificar pago ────────────────────────────────────────────
  verificar_pago_mp: async (ctx, args) => {
    requireTenant(ctx)
    const preferenceId = (args.preference_id as string | undefined)?.trim()
    if (!preferenceId) return { ok: false, error: 'preference_id es requerido' }

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'mercadopago')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'MercadoPago no conectado', motivo: 'sin_integracion' }
    }

    const accessToken = (integ.metadata as any)?.access_token as string | null
    if (!accessToken) return { ok: false, error: 'Token MP no disponible' }

    const res = await fetch(
      `https://api.mercadopago.com/checkout/preferences/${preferenceId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal:  AbortSignal.timeout(10_000),
      },
    )

    if (!res.ok) {
      return { ok: false, error: `MP error ${res.status}` }
    }

    const pref = await res.json()
    return {
      ok: true,
      data: {
        estado:     pref.status ?? 'desconocido',
        preference_id: pref.id,
        items:      (pref.items ?? []).map((i: any) => ({ nombre: i.title, monto: i.unit_price })),
      },
    }
  },

  // ── Pagos: registrar pago manual ───────────────────────────────────────────
  registrar_pago_manual: async (ctx, args) => {
    requireTenant(ctx)
    const pedidoId  = (args.pedido_id as string | undefined)?.trim()
    const monto     = args.monto_soles as number
    const metodo    = (args.metodo    as string | undefined)?.trim() ?? 'efectivo'
    const notas     = (args.notas     as string | undefined)?.trim()

    if (!pedidoId) return { ok: false, error: 'pedido_id es requerido' }
    if (!monto || monto <= 0) return { ok: false, error: 'monto_soles inválido' }

    const { data: pedido } = await ctx.supabase
      .from('pedidos')
      .select('id, total, numero_pedido')
      .eq('id', pedidoId)
      .eq('ferreteria_id', ctx.ferreteriaId)
      .single()

    if (!pedido) return { ok: false, error: 'Pedido no encontrado' }

    await ctx.supabase
      .from('pagos_registrados')
      .insert({
        pedido_id:    pedidoId,
        ferreteria_id: ctx.ferreteriaId,
        monto,
        metodo_pago:  metodo,
        notas:        notas ?? null,
        registrado_por: 'bot',
      })

    return {
      ok: true,
      data: {
        pedido_numero: (pedido as any).numero_pedido,
        monto_registrado: `S/ ${monto.toFixed(2)}`,
        metodo,
      },
    }
  },

  // ── Pagos: consultar saldo pendiente ──────────────────────────────────────
  consultar_saldo_pendiente: async (ctx, args) => {
    requireTenant(ctx)
    const pedidoId = (args.pedido_id as string | undefined)?.trim()
    if (!pedidoId) return { ok: false, error: 'pedido_id es requerido' }

    const { data: pedido } = await ctx.supabase
      .from('pedidos')
      .select('total, numero_pedido')
      .eq('id', pedidoId)
      .eq('ferreteria_id', ctx.ferreteriaId)
      .single()

    if (!pedido) return { ok: false, error: 'Pedido no encontrado' }

    const { data: pagos } = await ctx.supabase
      .from('pagos_registrados')
      .select('monto')
      .eq('pedido_id', pedidoId)

    const totalPagado = ((pagos ?? []) as any[]).reduce((sum, p) => sum + (p.monto ?? 0), 0)
    const totalPedido = (pedido as any).total as number
    const saldo = Math.max(0, totalPedido - totalPagado)

    return {
      ok: true,
      data: {
        pedido_numero:  (pedido as any).numero_pedido,
        total_pedido:   `S/ ${totalPedido.toFixed(2)}`,
        total_pagado:   `S/ ${totalPagado.toFixed(2)}`,
        saldo_pendiente:`S/ ${saldo.toFixed(2)}`,
        pagado_completo: saldo === 0,
      },
    }
  },

  // ── Crédito formal: consultar ────────────────────────────────────────────
  consultar_credito_formal: async (ctx, args) => {
    requireTenant(ctx)
    const tipo = (args.tipo as string | undefined) ?? 'todos'

    // Buscar cliente por teléfono
    const { data: cliente } = await ctx.supabase
      .from('clientes')
      .select('id, nombre')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('telefono', ctx.telefonoCliente)
      .maybeSingle()

    if (!cliente) {
      return { ok: true, data: { creditos: [], mensaje: 'No se encontró perfil de cliente registrado' } }
    }

    let query = ctx.supabase
      .from('creditos')
      .select('id, monto_total, monto_pagado, fecha_limite, estado, notas')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('cliente_id', (cliente as any).id)

    if (tipo === 'activo' || tipo === 'vencido') {
      query = query.eq('estado', tipo)
    } else {
      query = query.in('estado', ['activo', 'vencido'])
    }

    const { data: creditos } = await query.order('fecha_limite', { ascending: true })

    const items = ((creditos ?? []) as any[]).map((c) => ({
      id:               c.id,
      monto_total:      `S/ ${Number(c.monto_total).toFixed(2)}`,
      monto_pagado:     `S/ ${Number(c.monto_pagado).toFixed(2)}`,
      saldo_pendiente:  `S/ ${Math.max(0, Number(c.monto_total) - Number(c.monto_pagado)).toFixed(2)}`,
      fecha_vencimiento: c.fecha_limite,
      estado:           c.estado,
      notas:            c.notas ?? undefined,
    }))

    const totalPendiente = ((creditos ?? []) as any[]).reduce(
      (sum, c) => sum + Math.max(0, Number(c.monto_total) - Number(c.monto_pagado)), 0
    )

    return {
      ok: true,
      data: {
        cliente:                 (cliente as any).nombre,
        creditos:                items,
        total_credito_pendiente: `S/ ${totalPendiente.toFixed(2)}`,
        cantidad:                items.length,
      },
    }
  },

  // ── Crédito formal: registrar abono ──────────────────────────────────────
  registrar_abono_credito: async (ctx, args) => {
    requireTenant(ctx)
    const creditoId = (args.credito_id as string | undefined)?.trim()
    const monto     = args.monto as number | undefined
    const metodoPago = (args.metodo_pago as string | undefined) ?? null
    const notas      = (args.notas as string | undefined) ?? null

    if (!creditoId || !monto || monto <= 0) {
      return { ok: false, error: 'credito_id y monto (> 0) son requeridos' }
    }

    // Verificar que el crédito pertenece a este tenant
    const { data: credito } = await ctx.supabase
      .from('creditos')
      .select('id, monto_total, monto_pagado, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('id', creditoId)
      .maybeSingle()

    if (!credito) return { ok: false, error: 'Crédito no encontrado para esta tienda' }
    if ((credito as any).estado === 'pagado') {
      return { ok: false, error: 'Este crédito ya fue cancelado completamente' }
    }

    const nuevoMontoPagado = Number((credito as any).monto_pagado) + monto
    const cancelado        = nuevoMontoPagado >= Number((credito as any).monto_total)

    // Insertar abono
    await ctx.supabase.from('abonos_credito').insert({
      credito_id:   creditoId,
      monto,
      metodo_pago:  metodoPago,
      notas,
    })

    // Actualizar crédito
    await ctx.supabase.from('creditos').update({
      monto_pagado: nuevoMontoPagado,
      ...(cancelado ? { estado: 'pagado' } : {}),
    }).eq('id', creditoId)

    const saldoRestante = Math.max(0, Number((credito as any).monto_total) - nuevoMontoPagado)

    return {
      ok: true,
      data: {
        abono_registrado: `S/ ${monto.toFixed(2)}`,
        saldo_restante:   `S/ ${saldoRestante.toFixed(2)}`,
        estado:           cancelado ? 'pagado' : (credito as any).estado,
        credito_cancelado: cancelado,
      },
    }
  },

  // ── Inventario: listar stock bajo ─────────────────────────────────────────
  listar_stock_bajo: async (ctx, args) => {
    requireTenant(ctx)
    const limite = Math.min(30, (args.limite as number | undefined) ?? 15)

    const { data: productos } = await ctx.supabase
      .from('productos')
      .select('nombre, stock, stock_minimo, unidad')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('activo', true)
      .not('stock_minimo', 'is', null)
      .order('stock', { ascending: true })
      .limit(limite * 2)

    const bajos = ((productos ?? []) as any[]).filter(
      (p) => p.stock_minimo !== null && (p.stock ?? 0) <= (p.stock_minimo ?? 0)
    ).slice(0, limite)

    return {
      ok: true,
      data: {
        productos_con_stock_bajo: bajos.map((p) => ({
          nombre:  p.nombre,
          stock:   p.stock ?? 0,
          minimo:  p.stock_minimo,
          unidad:  p.unidad ?? 'und',
        })),
        total: bajos.length,
      },
    }
  },

  // ── Inventario: rotación de producto ──────────────────────────────────────
  consultar_rotacion_producto: async (ctx, args) => {
    requireTenant(ctx)
    const productoNombre = (args.producto_nombre as string | undefined)?.trim()
    const dias = Math.min(365, (args.dias as number | undefined) ?? 30)

    if (!productoNombre) return { ok: false, error: 'producto_nombre es requerido' }

    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

    const { data: lineas } = await ctx.supabase
      .from('cotizacion_lineas')
      .select('cantidad, precio_unitario, cotizaciones!inner(estado, created_at, ferreteria_id)')
      .eq('cotizaciones.ferreteria_id', ctx.ferreteriaId)
      .eq('cotizaciones.estado', 'convertida')
      .gte('cotizaciones.created_at', desde)
      .ilike('nombre_producto', `%${productoNombre}%`)

    const unidadesVendidas = ((lineas ?? []) as any[]).reduce((sum, l) => sum + (l.cantidad ?? 0), 0)
    const ingresoTotal     = ((lineas ?? []) as any[]).reduce((sum, l) => sum + ((l.cantidad ?? 0) * (l.precio_unitario ?? 0)), 0)

    return {
      ok: true,
      data: {
        producto:         productoNombre,
        periodo_dias:     dias,
        unidades_vendidas: unidadesVendidas,
        ingreso_total:    `S/ ${ingresoTotal.toFixed(2)}`,
        promedio_diario:  (unidadesVendidas / dias).toFixed(2),
      },
    }
  },

  // ── Inventario: subir catálogo a Drive ────────────────────────────────────
  subir_catalogo_drive: async (ctx) => {
    requireTenant(ctx)

    const { data: integ } = await ctx.supabase
      .from('integraciones_conectadas')
      .select('metadata, estado')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('tipo', 'google')
      .single()

    if (!integ || integ.estado !== 'conectado') {
      return { ok: false, error: 'Google Drive no conectado', motivo: 'sin_integracion' }
    }

    const { data: productos } = await ctx.supabase
      .from('productos')
      .select('nombre, descripcion, precio, stock, unidad, categoria')
      .eq('ferreteria_id', ctx.ferreteriaId)
      .eq('activo', true)
      .order('nombre')
      .limit(5000)

    const rows = (productos ?? []) as any[]
    const headers = 'Nombre,Descripción,Precio (S/),Stock,Unidad,Categoría'
    const csvLines = rows.map((p) =>
      [p.nombre, p.descripcion ?? '', p.precio, p.stock ?? 0, p.unidad ?? '', p.categoria ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [headers, ...csvLines].join('\n')

    const tokens = integ.metadata as any
    const { accessToken } = await getValidAccessToken(tokens)
    const folderId = await obtenerOCrearCarpetaFerroBot(accessToken)

    const fecha = new Date().toLocaleDateString('es-PE').replace(/\//g, '-')
    const res = await subirArchivoaDrive({
      accessToken,
      nombre:   `Catalogo_${fecha}.csv`,
      mimeType: 'text/csv',
      contenido: new TextEncoder().encode(csv).buffer as ArrayBuffer,
      folderId:  folderId ?? undefined,
    })

    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, data: { link: res.webLink, productos: rows.length, fecha } }
  },
}
