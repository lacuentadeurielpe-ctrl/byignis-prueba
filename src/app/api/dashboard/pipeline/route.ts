import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const fid = session.ferreteriaId

  try {
    const pedidosActivos = await ventasRepo.obtenerPedidosActivosPipeline(fid)
    
    const pipeline: Record<string, number> = {}
    for (const p of pedidosActivos ?? []) pipeline[p.estado] = (pipeline[p.estado] ?? 0) + 1

    const ESTADOS_EN_CURSO = ['pendiente', 'confirmado', 'en_preparacion', 'listo_para_recojo', 'enviado']
    
    const pedidosRecientes = (pedidosActivos ?? [])
      .filter((p: any) => ESTADOS_EN_CURSO.includes(p.estado))
      .slice(0, 5)

    return NextResponse.json({
      pipeline,
      pedidosRecientes: pedidosRecientes.map((p: any) => ({
        id: p.id,
        nombre_cliente: p.nombre_cliente,
        numero_pedido: p.numero_pedido,
        estado: p.estado
      }))
    })
  } catch (err) {
    console.error('Error en /api/dashboard/pipeline:', err)
    return NextResponse.json({ error: 'Error cargando pipeline' }, { status: 500 })
  }
}
