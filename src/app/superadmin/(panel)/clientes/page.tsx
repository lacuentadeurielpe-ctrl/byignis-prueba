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
    .select('id, nombre, email, telefono_whatsapp, created_at, owner_id, suscripciones(estado)')
    .order('created_at', { ascending: false })

  // Obtener usuarios reales de Auth para cruzar el email correcto del dueño
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const usersMap = new Map((users || []).map(u => [u.id, u.email]))

  const clientes = (ferreterias || []).map((f: any) => ({
    id: f.id,
    nombre: f.nombre || 'Sin Nombre',
    email: usersMap.get(f.owner_id) || f.email || 'Sin Correo',
    telefono_whatsapp: f.telefono_whatsapp || '',
    created_at: f.created_at,
    estado: (Array.isArray(f.suscripciones) 
      ? f.suscripciones[0]?.estado 
      : f.suscripciones?.estado) || 'suspendido'
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ClientList clientes={clientes} />
    </div>
  )
}
