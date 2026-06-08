'use client'

import { Cloud, MessageCircle, FileText, MapPin, Zap, Banknote, BookOpen, Code } from 'lucide-react'
import { useMemo } from 'react'
import SettingsHeader from '../components/SettingsHeader'
import IntegrationCard from './components/IntegrationCard'

const INTEGRACIONES_CORE = [
  {
    id: 'ycloud',
    name: 'YCloud',
    description: 'API WhatsApp para mensajes bidireccionales',
    icon: MessageCircle,
    status: 'desconectado' as const,
    href: '/dashboard/settings-2/integraciones/ycloud',
  },
  {
    id: 'nubefact',
    name: 'Nubefact',
    description: 'Facturación electrónica SUNAT',
    icon: FileText,
    status: 'desconectado' as const,
    href: '/dashboard/settings-2/integraciones/nubefact',
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Pagos y recaudación en línea',
    icon: Banknote,
    status: 'desconectado' as const,
    href: '/dashboard/settings-2/integraciones/mercadopago',
  },
  {
    id: 'maps',
    name: 'Google Maps',
    description: 'Geocoding y rutas de delivery',
    icon: MapPin,
    status: 'conectado' as const,
    href: '/dashboard/settings-2/integraciones/maps',
  },
]

const INTEGRACIONES_ROADMAP = [
  {
    id: 'osmio',
    name: 'OSMIO',
    description: 'Plataforma de envíos',
    icon: Cloud,
    comingSoon: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Pagos internacionales',
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
    description: 'Integraciones personalizadas',
    icon: Code,
    comingSoon: true,
  },
]

export default function IntegracionesPage() {
  return (
    <div>
      <SettingsHeader
        title="Integraciones"
        description="Conecta servicios externos para ampliar funcionalidades"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }]}
      />

      <div className="p-6 max-w-6xl space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Integraciones Principales</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {INTEGRACIONES_CORE.map(integration => (
              <IntegrationCard
                key={integration.id}
                {...integration}
                actionLabel="Configurar"
              />
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-8">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Próximamente</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {INTEGRACIONES_ROADMAP.map(integration => (
              <IntegrationCard
                key={integration.id}
                {...integration}
              />
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
          <p className="text-sm text-blue-900">
            💡 <strong>Tip:</strong> Las integraciones requieren tokens/claves API. Guarda-las en un lugar seguro.
          </p>
        </div>
      </div>
    </div>
  )
}
