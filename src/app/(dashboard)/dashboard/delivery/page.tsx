import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Truck } from 'lucide-react'
import DeliveryDashboard from './DeliveryDashboard'
import { inicioDiaLima } from '@/lib/tiempo'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'

export const dynamic = 'force-dynamic'

export default async function DeliveryPage() {
  const session = await getSessionInfo()
  if (!session) redirect('/auth/login')

  const supabase = await createClient()
  const deliveryRepo = new DeliveryRepository(supabase)

  // Cargar entregas del día (activas + completadas hoy)
  const hoy = new Date().toISOString().slice(0, 10)

  // Próximos 14 días para pedidos programados (Lima UTC = hoy 05:00Z → +14 días)
  const inicioHoy   = inicioDiaLima(0)
  const fin14dias   = inicioDiaLima(15)   // exclusivo → 14 días completos

  const [entregas, pedidosProgramados] = await Promise.all([
    deliveryRepo.obtenerEntregasDashboard(session.ferreteriaId, hoy),
    deliveryRepo.obtenerPedidosProgramados(session.ferreteriaId, inicioHoy, fin14dias),
  ])

  // Fetch confidence data for active entregas (for IA badges in dashboard)
  const entregaIds = (entregas ?? [])
    .filter((e: { estado: string }) => ['pendiente', 'carga', 'en_ruta'].includes(e.estado))
    .map((e: { id: string }) => e.id)

  let confidenceMap: Record<string, { confidence: number; source: string }> = {}
  if (entregaIds.length > 0) {
    const { data: predictions } = await supabase
      .from('delivery_predictions')
      .select('entrega_id, confidence, eta_source')
      .in('entrega_id', entregaIds)

    confidenceMap = Object.fromEntries(
      (predictions ?? []).map((p: { entrega_id: string; confidence: number; eta_source: string }) => [
        p.entrega_id,
        { confidence: p.confidence, source: p.eta_source },
      ])
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Delivery</h1>
          <p className="text-sm text-zinc-400">Rutas activas y pedidos programados</p>
        </div>
      </div>

      <DeliveryDashboard
        initialEntregas={(entregas ?? []) as any}
        initialProgramados={(pedidosProgramados ?? []) as any}
        confidenceMap={confidenceMap}
      />
    </div>
  )
}
