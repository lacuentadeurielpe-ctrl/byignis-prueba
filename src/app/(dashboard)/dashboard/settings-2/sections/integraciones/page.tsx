'use client'

import SettingsHeader from '../../components/SettingsHeader'

export default function IntegracionesPage() {
  return (
    <div>
      <SettingsHeader
        title="Integraciones"
        description="Conecta servicios externos a tu ferretería"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Integraciones' }]}
      />

      <div className="p-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
          <h2 className="text-lg font-bold text-zinc-900 mb-2">Integraciones</h2>
          <p className="text-sm text-zinc-500">Contenido en desarrollo - FASE 3</p>
        </div>
      </div>
    </div>
  )
}
