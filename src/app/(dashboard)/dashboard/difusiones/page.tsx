import { createClient }  from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect }       from 'next/navigation'
import DifusionesClient   from './DifusionesClient'

export const dynamic = 'force-dynamic'

export default async function DifusionesPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const [{ data: campanas }, { data: plantillas }] = await Promise.all([
    supabase
      .from('campanas')
      .select('*, plantillas_wa(id, nombre, meta_status)')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('plantillas_wa')
      .select('id, nombre, meta_status, categoria')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('nombre'),
  ])

  return (
    <DifusionesClient
      campanasIniciales={campanas ?? []}
      plantillas={plantillas ?? []}
    />
  )
}
