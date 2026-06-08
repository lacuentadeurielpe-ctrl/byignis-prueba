'use client'

import SettingsHeader from '../../components/SettingsHeader'

export default function EquipoPage() {
  return (
    <div>
      <SettingsHeader
        title="Equipo"
        description="Gestiona tu equipo de trabajo"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Equipo' }]}
      />
      <div className="p-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
          <p className="text-sm text-zinc-500">Sección en desarrollo - FASE 4</p>
        </div>
      </div>
    </div>
  )
}
