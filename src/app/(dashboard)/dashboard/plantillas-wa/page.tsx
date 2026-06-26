import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo }    from '@/lib/auth/roles'
import { redirect }          from 'next/navigation'
import PlantillasWAClient    from './PlantillasWAClient'

export const dynamic = 'force-dynamic'

export default async function PlantillasWAPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()

  const [{ data: plantillas }, { data: metaConfig }] = await Promise.all([
    supabase
      .from('plantillas_wa')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('configuracion_meta')
      .select('estado_conexion, waba_id')
      .eq('ferreteria_id', session.ferreteriaId)
      .maybeSingle(),
  ])

  const tieneMetaActivo = metaConfig?.estado_conexion === 'activo' && !!metaConfig.waba_id

  return (
    <PlantillasWAClient
      plantillasIniciales={plantillas ?? []}
      tieneMetaActivo={tieneMetaActivo}
    />
  )
}
