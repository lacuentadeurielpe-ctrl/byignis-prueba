import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { checkPermiso } from '@/lib/auth/permisos'

export const dynamic = 'force-dynamic'

// GET /api/sucursales/stock?productoId=... — distribución de stock por sucursal.
// Sin productoId devuelve toda la distribución del tenant (para el catálogo).
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!checkPermiso(session, 'ver_stock')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const productoId = searchParams.get('productoId')

  let query = supabase
    .from('stock_locales')
    .select('producto_id, local_id, stock, stock_minimo, locales_ferreteria(nombre, es_principal)')
    .eq('ferreteria_id', session.ferreteriaId)

  if (productoId) query = query.eq('producto_id', productoId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
