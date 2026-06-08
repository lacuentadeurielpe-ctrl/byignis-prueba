'use client'
import SettingsHeader from '../../components/SettingsHeader'
export default function DeliveryPage() {
  return (
    <div>
      <SettingsHeader title="Delivery" description="Configuración de entregas" breadcrumbs={[{ label: 'Configuración' }, { label: 'Delivery' }]} />
      <div className="p-6 max-w-4xl"><div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center"><p className="text-sm text-zinc-500">Sección en desarrollo - FASE 5</p></div></div>
    </div>
  )
}
