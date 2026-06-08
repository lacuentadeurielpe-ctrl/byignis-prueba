'use client'

import SettingsHeader from '../components/SettingsHeader'
import GeneralForm from './components/GeneralForm'
import HorariosForm from './components/HorariosForm'
import PagosMetodosForm from './components/PagosMetodosForm'
import LocalesForm from './components/LocalesForm'

export default function NegocioPage() {
  return (
    <div>
      <SettingsHeader
        title="Negocio"
        description="Configura los datos principales de tu ferreterÃ­a"
        breadcrumbs={[{ label: 'ConfiguraciÃ³n' }, { label: 'Negocio' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <GeneralForm />
        <LocalesForm />
        <HorariosForm />
        <PagosMetodosForm />
      </div>
    </div>
  )
}
