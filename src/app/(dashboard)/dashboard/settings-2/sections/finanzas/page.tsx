'use client'

import SettingsHeader from '../../components/SettingsHeader'
import FacturacionForm from './components/FacturacionForm'

export default function FinanzasPage() {
  return (
    <div>
      <SettingsHeader
        title="Finanzas"
        description="Configuración de facturación y plan SaaS"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Finanzas' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <FacturacionForm />
      </div>
    </div>
  )
}
