import { createAdminClient } from '@/lib/supabase/admin'
import ConfigClient from './ConfigClient'

export const dynamic = 'force-dynamic'

async function getConfig() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('config_plataforma')
    .select('clave, valor, descripcion, actualizado_at')
    .order('clave')
  return data ?? []
}

export default async function ConfigPage() {
  const config = await getConfig()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Config Global</h1>
        <p className="text-gray-400 text-sm mt-1">Parámetros de la plataforma — se aplican a todos los tenants</p>
      </div>
      <ConfigClient config={config} />
    </div>
  )
}
