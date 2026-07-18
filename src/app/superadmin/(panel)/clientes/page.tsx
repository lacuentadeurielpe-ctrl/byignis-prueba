import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSuperadminSession } from '@/lib/auth/superadmin'
import ClientList from './ClientList'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  noStore()
  const session = await getSuperadminSession()
  if (!session) redirect('/superadmin/login')

  const supabase = createAdminClient()

  const { data: ferreterias } = await supabase
    .from('ferreterias')
    .select('id, nombre, email, telefono_whatsapp, created_at, suscripciones(estado)')
    .order('created_at', { ascending: false })

  const clientes = (ferreterias || []).map((f: any) => ({
    id: f.id,
    nombre: f.nombre || 'Sin Nombre',
    email: f.email || 'Sin Correo',
    telefono_whatsapp: f.telefono_whatsapp || '',
    created_at: f.created_at,
    estado: f.suscripciones?.[0]?.estado || 'suspendido'
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ClientList clientes={clientes} />
    </div>
  )
}
