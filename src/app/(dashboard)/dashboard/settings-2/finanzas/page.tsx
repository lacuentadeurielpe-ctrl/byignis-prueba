'use client'

import SettingsHeader from '../components/SettingsHeader'
import FacturacionForm from './components/FacturacionForm'

export default function FinanzasPage() {
  return (
    <div>
      <SettingsHeader
        title="Finanzas"
        description="ConfiguraciÃ³n de facturaciÃ³n y plan SaaS"
        breadcrumbs={[{ label: 'ConfiguraciÃ³n' }, { label: 'Finanzas' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <FacturacionForm />
      </div>
    </div>
  )
}
