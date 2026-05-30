import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import ClientPOS from './ClientPOS'

export const metadata = {
  title: 'Caja POS | Ferrobot'
}

export default async function POSPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()

  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, unidad, precio_base, precio_compra, stock, codigo_barras')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('activo', true)
    .order('nombre')

  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('nombre')
    .eq('id', session.ferreteriaId)
    .single()

  return (
    <ClientPOS 
      productos={productos || []} 
      nombreFerreteria={ferreteria?.nombre ?? 'Ferretería'} 
      ferreteriaId={session.ferreteriaId}
    />
  )
}
