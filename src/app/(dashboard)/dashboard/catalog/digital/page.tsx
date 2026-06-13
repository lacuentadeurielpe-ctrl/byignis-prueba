import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import CatalogNav from '@/components/catalog/CatalogNav'
import DigitalProductsClient from '@/components/catalog/DigitalProductsClient'
import type { ProductoDigital } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function DigitalCatalogPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('productos_digitales')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  const productos = (data ?? []) as ProductoDigital[]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Catálogo</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Gestiona tu catálogo de productos y servicios</p>
        </div>
      </div>

      <CatalogNav />
      <DigitalProductsClient initial={productos} />
    </div>
  )
}
