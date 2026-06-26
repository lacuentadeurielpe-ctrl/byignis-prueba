import { createClient }     from '@/lib/supabase/server'
import { getSessionInfo }   from '@/lib/auth/roles'
import { redirect }         from 'next/navigation'
import PlantillasWAClient   from './PlantillasWAClient'

export const dynamic = 'force-dynamic'

export default async function PlantillasWAPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const { data: plantillas } = await supabase
    .from('plantillas_wa')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  return <PlantillasWAClient plantillasIniciales={plantillas ?? []} />
}
