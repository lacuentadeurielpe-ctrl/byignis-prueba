'use client'

import { Bot, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ToolEntry {
  label: string
  descripcion: string
}

interface SystemFeature {
  label: string
  descripcion: string
}

interface IntegracionInfo {
  tools: ToolEntry[]
  features?: SystemFeature[]
}

const INTEGRACION_DATA: Record<string, IntegracionInfo> = {
  telegram: {
    tools: [
      { label: 'Notificar nuevo pedido', descripcion: 'El bot avisa al canal de la tienda cuando un cliente confirma un pedido por WhatsApp' },
      { label: 'Alerta de stock bajo', descripcion: 'Mensaje automático al canal cuando un producto cae por debajo del stock mínimo' },
    ],
  },
  resend: {
    tools: [
      { label: 'Enviar cotización por email', descripcion: 'El bot envía el PDF de la cotización al email del cliente directamente desde el chat' },
      { label: 'Notificación de pedido', descripcion: 'Email al dueño cuando se confirma un nuevo pedido en WhatsApp' },
      { label: 'Recordatorio de pago', descripcion: 'Email automático al cliente cuando tiene una deuda o factura pendiente' },
    ],
  },
  mercadopago: {
    tools: [
      { label: 'Generar link de cobro', descripcion: 'El bot crea un link de pago MercadoPago y lo envía al cliente por WhatsApp en segundos' },
      { label: 'Verificar pago', descripcion: 'El bot consulta si el cliente ya pagó el link que se le envió, sin que nadie tenga que revisar manualmente' },
    ],
  },
  google: {
    tools: [
      { label: 'Enviar email con Gmail', descripcion: 'Envía cotizaciones, confirmaciones y documentos desde la cuenta de Gmail conectada' },
      { label: 'Crear evento de entrega', descripcion: 'Agenda la entrega del pedido como evento en Google Calendar con datos del cliente' },
      { label: 'Agendar visita técnica', descripcion: 'Coordina visitas técnicas con clientes y las añade automáticamente al calendario' },
      { label: 'Consultar agenda del día', descripcion: 'El bot sabe qué entregas y citas están programadas hoy y puede informar al cliente' },
      { label: 'Guardar comprobante en Drive', descripcion: 'Sube PDFs de facturas y boletas a la carpeta FerroBot en Google Drive' },
      { label: 'Exportar catálogo a Drive', descripcion: 'Genera un CSV del catálogo de productos y lo sube a Drive para respaldo o compartir' },
    ],
  },
  sunat_directo: {
    tools: [],
    features: [
      { label: 'Emisión de boletas y facturas SUNAT', descripcion: 'El bot puede solicitar la emisión de comprobantes electrónicos válidos ante SUNAT al confirmar una venta' },
      { label: 'Homologación en modo beta', descripcion: 'Prueba el flujo completo de facturación contra el entorno beta de SUNAT antes de pasar a producción' },
    ],
  },
  maps: {
    tools: [],
    features: [
      { label: 'Geocodificación de direcciones', descripcion: 'Convierte la dirección que escribe el cliente en coordenadas GPS para el sistema de delivery' },
      { label: 'Cálculo de rutas de entrega', descripcion: 'Estima distancias y rutas para asignar el vehículo más cercano al pedido' },
    ],
  },
  ycloud: {
    tools: [],
    features: [
      { label: 'Canal de WhatsApp bidireccional', descripcion: 'Habilita la recepción y envío de mensajes, imágenes, audios y documentos por WhatsApp Business API' },
      { label: 'Verificación HMAC de webhooks', descripcion: 'Valida que cada mensaje entrante proviene realmente de YCloud, no de terceros' },
    ],
  },
}

interface Props {
  integracionId: string
  isConnected?: boolean
}

export default function ToolsEnabledSection({ integracionId, isConnected = false }: Props) {
  const info = INTEGRACION_DATA[integracionId]
  if (!info) return null

  const hasTools    = info.tools.length > 0
  const hasFeatures = (info.features?.length ?? 0) > 0
  if (!hasTools && !hasFeatures) return null

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-zinc-900">
          {hasTools ? 'Herramientas que activa en el bot' : 'Funciones del sistema que activa'}
        </span>
        {!isConnected && (
          <span className="ml-auto text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">Requiere conexión</span>
        )}
      </div>

      <div className="divide-y divide-zinc-100">
        {hasTools && info.tools.map((tool) => (
          <div key={tool.label} className="flex items-start gap-3 px-5 py-3.5">
            <Bot className={`w-4 h-4 mt-0.5 shrink-0 ${isConnected ? 'text-indigo-500' : 'text-zinc-300'}`} />
            <div>
              <p className={`text-sm font-medium ${isConnected ? 'text-zinc-800' : 'text-zinc-500'}`}>{tool.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{tool.descripcion}</p>
            </div>
            {isConnected && (
              <span className="ml-auto shrink-0 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Activa</span>
            )}
          </div>
        ))}

        {hasFeatures && info.features!.map((feature) => (
          <div key={feature.label} className="flex items-start gap-3 px-5 py-3.5">
            <Zap className={`w-4 h-4 mt-0.5 shrink-0 ${isConnected ? 'text-amber-500' : 'text-zinc-300'}`} />
            <div>
              <p className={`text-sm font-medium ${isConnected ? 'text-zinc-800' : 'text-zinc-500'}`}>{feature.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{feature.descripcion}</p>
            </div>
            {isConnected && (
              <span className="ml-auto shrink-0 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Activa</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
