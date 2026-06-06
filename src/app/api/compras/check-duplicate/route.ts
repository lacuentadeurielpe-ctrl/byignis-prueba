import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/compras/check-duplicate?numero_factura=F001-12345
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const numeroFactura = searchParams.get('numero_factura')?.trim()

  if (!numeroFactura) {
    return NextResponse.json({ duplicado: false })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('compras')
    .select('id, numero_compra, fecha_factura, proveedor_nombre, total_neto, estado, created_at')
    .eq('ferreteria_id', session.ferreteriaId)
    .eq('numero_factura', numeroFactura)
    .neq('estado', 'anulada') // ignorar anuladas
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ duplicado: false })
  }

  return NextResponse.json({
    duplicado: true,
    compra: {
      id: data.id,
      numero_compra: data.numero_compra,
      fecha_factura: data.fecha_factura,
      proveedor_nombre: data.proveedor_nombre,
      total_neto: data.total_neto,
      estado: data.estado,
      registrado_el: data.created_at,
    }
  })
}
