'use client'
import SettingsHeader from '../../components/SettingsHeader'
export default function FinanzasPage() {
  return (
    <div>
      <SettingsHeader title="Finanzas" description="Configuración de facturación y plan" breadcrumbs={[{ label: 'Configuración' }, { label: 'Finanzas' }]} />
      <div className="p-6 max-w-4xl"><div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center"><p className="text-sm text-zinc-500">Sección en desarrollo - FASE 2</p></div></div>
    </div>
  )
}
