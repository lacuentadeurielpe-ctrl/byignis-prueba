import { createClient }   from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect }       from 'next/navigation'
import BandejaSettingsClient from './BandejaSettingsClient'
import SettingsHeader     from '../components/SettingsHeader'

export const dynamic = 'force-dynamic'

export default async function BandejaSettingsPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const [{ data: etiquetas }, { data: respuestas }] = await Promise.all([
    supabase.from('etiquetas').select('*').eq('ferreteria_id', session.ferreteriaId).order('orden').order('nombre'),
    supabase.from('respuestas_rapidas').select('*').eq('ferreteria_id', session.ferreteriaId).order('orden').order('atajo'),
  ])

  return (
    <div>
      <SettingsHeader
        title="Bandeja de mensajes"
        description="Configura etiquetas, respuestas rápidas y opciones de la bandeja"
        breadcrumbs={[{ label: 'Configuración' }, { label: 'Bandeja' }]}
      />
      <BandejaSettingsClient
        etiquetasIniciales={etiquetas ?? []}
        respuestasIniciales={respuestas ?? []}
      />
    </div>
  )
}
