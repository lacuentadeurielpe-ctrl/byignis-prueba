import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import ClientPOS from './ClientPOS'
import { CatalogRepository } from '@/lib/db/repositories/catalogo'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'

export const metadata = {
  title: 'Caja POS | Ferrobot'
}

export default async function POSPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const catalogRepo = new CatalogRepository(supabase)
  const facturacionRepo = new FacturacionRepository(supabase)

  const [productos, ferreteria] = await Promise.all([
    catalogRepo.listarProductosActivos(session.ferreteriaId),
    facturacionRepo.obtenerFerreteriaInfo(session.ferreteriaId),
  ])

  return (
    <ClientPOS 
      productos={productos || []} 
      nombreFerreteria={ferreteria?.nombre ?? 'Ferretería'} 
      ferreteriaId={session.ferreteriaId}
    />
  )
}
