'use client'

import SettingsHeader from '../components/SettingsHeader'
import GeneralForm from './components/GeneralForm'
import HorariosForm from './components/HorariosForm'
import PagosMetodosForm from './components/PagosMetodosForm'
import LocalesForm from './components/LocalesForm'
import WelcomeBanner from './components/WelcomeBanner'
import ComprobanteAparienciaForm from './components/ComprobanteAparienciaForm'
import CatalogoPublicoForm from './components/CatalogoPublicoForm'

export default function NegocioPage() {
  return (
    <div>
      <SettingsHeader
        title="Negocio"
        description="Configura los datos principales de tu negocio"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Negocio' }]}
      />

      <div className="p-4 md:p-6 max-w-4xl space-y-4 md:space-y-6">
        <WelcomeBanner />
        <GeneralForm />
        <CatalogoPublicoForm />
        <ComprobanteAparienciaForm />
        <LocalesForm />
        <HorariosForm />
        <PagosMetodosForm />
      </div>
    </div>
  )
}
