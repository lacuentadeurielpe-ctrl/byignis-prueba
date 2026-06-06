import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { inicioDiaLima, fechaLimaStr, fechaLocalLima } from '@/lib/tiempo'

export const dynamic = 'force-dynamic'

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const fid = session.ferreteriaId
  const hace30 = inicioDiaLima(-29)

  try {
    const [pedidos30d, cotizaciones30d, itemsCotizacion] = await Promise.all([
      ventasRepo.obtenerPedidosDesdeFecha(fid, hace30),
      ventasRepo.obtenerCotizacionesDesdeFecha(fid, hace30),
      ventasRepo.obtenerTopProductos30d(fid, hace30)
    ])

    const chartData = Array.from({ length: 30 }, (_, i) => {
      const fechaStr  = fechaLimaStr(-29 + i)
      const diaSemana = new Date(`${fechaStr}T12:00:00Z`).getUTCDay()
      const dd = fechaStr.slice(8, 10); const mm = fechaStr.slice(5, 7)
      return {
        dia: `${dd}/${mm}`, 
        diaSemana: DIAS_CORTOS[diaSemana],
        pedidos: (pedidos30d ?? []).filter((p: any) => fechaLocalLima(p.created_at) === fechaStr).length,
        cotizaciones: (cotizaciones30d ?? []).filter((c: any) => fechaLocalLima(c.created_at) === fechaStr).length,
      }
    })

    const conteoProductos: Record<string, number> = {}
    for (const item of itemsCotizacion ?? []) {
      conteoProductos[item.nombre_producto] = (conteoProductos[item.nombre_producto] ?? 0) + (item.cantidad ?? 1)
    }
    
    const topProductos = Object.entries(conteoProductos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))

    return NextResponse.json({ chartData, topProductos })
  } catch (err) {
    console.error('Error en /api/dashboard/charts:', err)
    return NextResponse.json({ error: 'Error cargando gráficos' }, { status: 500 })
  }
}
