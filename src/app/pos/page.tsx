import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import ClientPOS from './ClientPOS'
import { CatalogRepository } from '@/lib/db/repositories/catalogo'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'
import { tieneFacturacionActiva } from '@/lib/facturacion/lycet/credenciales'

export const metadata = {
  title: 'Caja POS | Uintegrus'
}

export default async function POSPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  if (session.rol === 'dueno' && !session.onboardingCompleto) {
    redirect('/onboarding')
  }

  // Suscripción 'activo' o trial vigente; si no, bloquear acceso a la caja POS
  if (!session.suscripcionActiva) {
    redirect('/paywall')
  }

  const supabase = await createClient()
  const catalogRepo = new CatalogRepository(supabase)
  const facturacionRepo = new FacturacionRepository(supabase)

  // Misma regla que Ventas: hay facturación electrónica si el negocio tiene
  // credenciales SUNAT activas. La emisión resuelve el adapter automáticamente
  // (/api/comprobantes/emitir → resolverProveedor).
  const [productos, ferreteria, facturacionActiva] = await Promise.all([
    catalogRepo.listarProductosActivos(session.ferreteriaId),
    facturacionRepo.obtenerFerreteriaInfo(session.ferreteriaId),
    tieneFacturacionActiva(supabase, session.ferreteriaId),
  ])

  return (
    <ClientPOS
      productos={productos || []}
      nombreFerreteria={ferreteria?.nombre ?? 'Negocio'}
      ferreteriaId={session.ferreteriaId}
      facturacionActiva={facturacionActiva}
    />
  )
}
