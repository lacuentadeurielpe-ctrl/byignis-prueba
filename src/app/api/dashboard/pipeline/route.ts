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
    const [pipeline, pedidosRecientes] = await Promise.all([
      ventasRepo.obtenerPipelineCounts(fid),
      ventasRepo.obtenerPedidosRecientesEnCurso(fid)
    ])

    return NextResponse.json({
      pipeline,
      pedidosRecientes
    })
  } catch (err) {
    console.error('Error en /api/dashboard/pipeline:', err)
    return NextResponse.json({ error: 'Error cargando pipeline' }, { status: 500 })
  }
}
