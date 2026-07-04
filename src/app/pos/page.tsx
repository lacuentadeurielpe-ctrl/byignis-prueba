import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import ClientPOS from './ClientPOS'
import { CatalogRepository } from '@/lib/db/repositories/catalogo'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'

export const metadata = {
  title: 'Caja POS | Uintegrus'
}

export default async function POSPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const catalogRepo = new CatalogRepository(supabase)
  const facturacionRepo = new FacturacionRepository(supabase)

  const [productos, ferreteria, facturacionData] = await Promise.all([
    catalogRepo.listarProductosActivos(session.ferreteriaId),
    facturacionRepo.obtenerFerreteriaInfo(session.ferreteriaId),
    facturacionRepo.obtenerDatosFerreteriaDashboard(session.ferreteriaId),
  ])

  // Misma regla que Ventas: hay proveedor de facturación disponible si Nubefact
  // tiene token O el negocio eligió SUNAT Directo. La emisión resuelve el
  // proveedor activo automáticamente (/api/comprobantes/emitir → resolverProveedor).
  const facturacionActiva =
    !!facturacionData?.nubefact_token_enc ||
    facturacionData?.proveedor_facturacion === 'sunat_directo'

  return (
    <ClientPOS
      productos={productos || []}
      nombreFerreteria={ferreteria?.nombre ?? 'Negocio'}
      ferreteriaId={session.ferreteriaId}
      facturacionActiva={facturacionActiva}
    />
  )
}
