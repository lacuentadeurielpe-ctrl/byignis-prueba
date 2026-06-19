'use client'

import {
  Cloud, MessageCircle, FileText, MapPin, Zap, Banknote,
  BookOpen, Code, Send, Mail, Globe2, Calendar, HardDrive,
} from 'lucide-react'
import SettingsHeader from '../components/SettingsHeader'
import IntegrationCard from './components/IntegrationCard'

const INTEGRACIONES_CORE = [
  {
    id: 'ycloud',
    name: 'YCloud',
    description: 'API WhatsApp para mensajes bidireccionales',
    icon: MessageCircle,
    href: '/dashboard/settings-2/integraciones/ycloud',
  },
  {
    id: 'nubefact',
    name: 'Nubefact',
    description: 'Facturación electrónica SUNAT',
    icon: FileText,
    href: '/dashboard/settings-2/integraciones/nubefact',
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Pagos en línea y links de cobro',
    icon: Banknote,
    href: '/dashboard/settings-2/integraciones/mercadopago',
  },
  {
    id: 'maps',
    name: 'Google Maps',
    description: 'Geocoding y rutas de delivery',
    icon: MapPin,
    href: '/dashboard/settings-2/integraciones/maps',
  },
]

const INTEGRACIONES_COMUNICACIONES = [
  {
    id: 'google',
    name: 'Google',
    description: 'Gmail · Calendar · Drive — un solo login',
    icon: Globe2,
    href: '/dashboard/settings-2/integraciones/google',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Notificaciones del bot al canal de la tienda',
    icon: Send,
    href: '/dashboard/settings-2/integraciones/telegram',
  },
  {
    id: 'resend',
    name: 'Email (Resend)',
    description: 'Envío de cotizaciones y alertas por email vía API',
    icon: Mail,
    href: '/dashboard/settings-2/integraciones/resend',
  },
]

const INTEGRACIONES_ROADMAP = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Sincronización de catálogo y stock',
    icon: Cloud,
    comingSoon: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Pagos internacionales con tarjeta',
    icon: Zap,
    comingSoon: true,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Contabilidad e impuestos',
    icon: BookOpen,
    comingSoon: true,
  },
  {
    id: 'webhooks',
    name: 'Custom Webhooks',
    description: 'Integraciones personalizadas vía HTTP',
    icon: Code,
    comingSoon: true,
  },
  {
    id: 'gcalendar_ext',
    name: 'Google Calendar público',
    description: 'Mostrar agenda en tu web',
    icon: Calendar,
    comingSoon: true,
  },
  {
    id: 'gdrive_ext',
    name: 'Google Drive Compartido',
    description: 'Carpeta compartida con clientes',
    icon: HardDrive,
    comingSoon: true,
  },
]

export default function IntegracionesPage() {
  return (
    <div>
      <SettingsHeader
        title="Integraciones"
        description="Conecta servicios externos para ampliar las herramientas del bot"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }]}
      />

      <div className="p-6 max-w-6xl space-y-8">
        {/* Core */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 mb-1">Operaciones</h3>
          <p className="text-xs text-zinc-500 mb-4">WhatsApp, pagos, facturación y mapas</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {INTEGRACIONES_CORE.map(integration => (
              <IntegrationCard key={integration.id} {...integration} actionLabel="Configurar" />
            ))}
          </div>
        </div>

        {/* Comunicaciones */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 mb-1">Comunicaciones</h3>
          <p className="text-xs text-zinc-500 mb-4">Email, mensajería y almacenamiento en la nube</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRACIONES_COMUNICACIONES.map(integration => (
              <IntegrationCard key={integration.id} {...integration} actionLabel="Configurar" />
            ))}
          </div>
        </div>

        {/* Roadmap */}
        <div className="border-t border-zinc-200 pt-8">
          <h3 className="text-sm font-semibold text-zinc-900 mb-1">Próximamente</h3>
          <p className="text-xs text-zinc-500 mb-4">Estas integraciones están en desarrollo</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRACIONES_ROADMAP.map(integration => (
              <IntegrationCard key={integration.id} {...integration} />
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            💡 <strong>Tip:</strong> Cada integración activa herramientas nuevas en el bot. Ve a <strong>Configuración → Bot → Agentes</strong> para ver qué herramientas se habilitaron.
          </p>
        </div>
      </div>
    </div>
  )
}
