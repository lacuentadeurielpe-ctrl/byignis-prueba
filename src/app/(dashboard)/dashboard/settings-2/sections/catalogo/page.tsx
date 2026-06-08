'use client'
import SettingsHeader from '../../components/SettingsHeader'
export default function CatalogoPage() {
  return (
    <div>
      <SettingsHeader title="Catálogo" description="Gestión de productos y categorías" breadcrumbs={[{ label: 'Configuración' }, { label: 'Catálogo' }]} />
      <div className="p-6 max-w-4xl"><div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center"><p className="text-sm text-zinc-500">Sección en desarrollo - FASE 4</p></div></div>
    </div>
  )
}
