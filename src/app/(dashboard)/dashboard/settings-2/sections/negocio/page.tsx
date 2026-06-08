'use client'

import SettingsHeader from '../../components/SettingsHeader'
import GeneralForm from './components/GeneralForm'
import HorariosForm from './components/HorariosForm'
import PagosMetodosForm from './components/PagosMetodosForm'

export default function NegocioPage() {
  return (
    <div>
      <SettingsHeader
        title="Negocio"
        description="Configura los datos principales de tu ferretería"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Negocio' }]}
      />

      <div className="p-6 max-w-4xl space-y-6">
        <GeneralForm />
        <HorariosForm />
        <PagosMetodosForm />
      </div>
    </div>
  )
}
