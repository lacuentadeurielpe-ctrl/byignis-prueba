import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CatalogNav from '@/components/catalog/CatalogNav'
import TransferManager from '@/components/catalog/TransferManager'
import { getSessionInfo } from '@/lib/auth/roles'
import { getContextoSucursal } from '@/lib/sucursales/contexto'

export default async function TransferenciasPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()

  // Si no tiene multi-sucursal activado, redirigir al catálogo
  if (!session.multiSucursal) {
    redirect('/dashboard/catalog')
  }

  // Cargar productos, locales y stock por local
  const [
    { data: productos },
    { data: locales },
    { data: stockLocales },
    { data: transferencias }
  ] = await Promise.all([
    supabase
      .from('productos')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('estado', 'activo')
      .order('nombre'),
    supabase
      .from('locales_ferreteria')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('stock_locales')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId),
    supabase
      .from('transferencias_stock')
      .select('*')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })
      .limit(50)
  ])

  // Obtener locales visibles por si el usuario es un empleado restringido
  const contexto = await getContextoSucursal(supabase, session)
  const localesVisibles = contexto.localesVisibles

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Transferencias de Stock</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Mueve inventario entre tus sucursales y mantén el control.
          </p>
        </div>
      </div>

      <CatalogNav />

      <TransferManager
        productos={productos ?? []}
        locales={localesVisibles ?? []}
        stockLocales={stockLocales ?? []}
        transferencias={transferencias ?? []}
      />
    </div>
  )
}
