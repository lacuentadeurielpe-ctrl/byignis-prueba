'use client'

import SettingsHeader from '../../components/SettingsHeader'

export default function NegocioPage() {
  return (
    <div>
      <SettingsHeader
        title="Negocio"
        description="Configura los datos principales de tu ferretería"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Negocio' }]}
      />

      <div className="p-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
          <h2 className="text-lg font-bold text-zinc-900 mb-2">Sección Negocio</h2>
          <p className="text-sm text-zinc-500">Contenido en desarrollo - FASE 2</p>
        </div>
      </div>
    </div>
  )
}
