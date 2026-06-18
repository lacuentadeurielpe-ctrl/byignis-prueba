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

  const [
    entregas,
    pedidosProgramados,
    colaData,
    incidenciasData,
    zonasCount,
    vehiculosCount,
    repartidoresRaw,
    vehiculosDeliveryRaw,
    entregasActivasMap,
    opsLogRaw,
  ] = await Promise.all([
    deliveryRepo.obtenerEntregasDashboard(session.ferreteriaId, hoy),
    deliveryRepo.obtenerPedidosProgramados(session.ferreteriaId, inicioHoy, fin14dias),
    // Count pedidos en cola (sin asignar)
    supabase
      .from('pedidos')
      .select('id, entregas!left(repartidor_id, estado)', { count: 'exact' })
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('modalidad', 'delivery')
      .in('estado', ['confirmado', 'en_preparacion', 'listo_para_recojo'])
      .then(({ data }) => {
        const sinAsignar = (data ?? []).filter((p: any) => {
          const activas = (p.entregas ?? []).filter((e: any) => !['entregado', 'fallida'].includes(e.estado))
          return activas.every((e: any) => !e.repartidor_id)
        })
        return sinAsignar.length
      }),
    // Count incidencias activas
    supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('ferreteria_id', session.ferreteriaId)
      .not('incidencia_tipo', 'is', null)
      .not('estado', 'in', '("entregado","cancelado","devuelto")')
      .then(({ count }) => count ?? 0),
    // ── Setup checks: zonas y vehículos configurados ──
    supabase
      .from('zonas_delivery')
      .select('id', { count: 'exact', head: true })
      .eq('ferreteria_id', session.ferreteriaId)
      .then(({ count }) => count ?? 0),
    supabase
      .from('vehiculos_delivery')
      .select('id', { count: 'exact', head: true })
      .eq('ferreteria_id', session.ferreteriaId)
      .then(({ count }) => count ?? 0),
    // ── Flota: repartidores con estado operativo ──
    supabase
      .from('repartidores')
      .select('id, nombre, estado_operativo, gps_ultima_lat, gps_ultima_lng, gps_actualizado_at')
      .eq('ferreteria_id', session.ferreteriaId)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => data ?? []),
    // ── Flota: vehículos delivery con repartidor asignado ──
    supabase
      .from('vehiculos_delivery')
      .select('id, nombre, tipo, placa, estado, descripcion_averia, est_resolucion_at, repartidores(nombre)')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('nombre')
      .then(({ data }) => data ?? []),
    // ── Entregas activas por repartidor (para contador) ──
    supabase
      .from('entregas')
      .select('repartidor_id')
      .eq('ferreteria_id', session.ferreteriaId)
      .in('estado', ['pendiente', 'carga', 'en_ruta'])
      .then(({ data }) => {
        const counts = new Map<string, number>()
        for (const e of data ?? []) {
          if (e.repartidor_id) {
            counts.set(e.repartidor_id, (counts.get(e.repartidor_id) ?? 0) + 1)
          }
        }
        return counts
      }),
    // ── Log de operaciones (últimas 50 entradas) ──
    supabase
      .from('delivery_operaciones_log')
      .select('id, tipo_evento, entidad_tipo, entidad_id, detalle, origen, resuelto, created_at')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => data ?? []),
  ])

  // Construir flota de repartidores con conteo de entregas activas
  const fleetRepartidores = (repartidoresRaw as any[]).map((r) => ({
    id:               r.id,
    nombre:           r.nombre ?? '',
    estado_operativo: r.estado_operativo ?? 'no_disponible',
    ultima_lat:       r.gps_ultima_lat as number | null,
    ultima_lng:       r.gps_ultima_lng as number | null,
    gps_actualizado_at: r.gps_actualizado_at as string | null,
    vehiculo:         null,
    entregasActivas:  (entregasActivasMap as Map<string, number>).get(r.id) ?? 0,
  }))

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
        colaCount={colaData as number}
        incidenciasCount={incidenciasData as number}
        sinZonas={(zonasCount as number) === 0}
        sinVehiculos={(vehiculosCount as number) === 0}
        fleetRepartidores={fleetRepartidores}
        fleetVehiculos={(vehiculosDeliveryRaw as any[]).map((v) => ({
          id:                v.id,
          nombre:            v.nombre ?? v.tipo,
          tipo:              v.tipo,
          placa:             v.placa as string | null,
          estado:            v.estado ?? 'disponible',
          descripcion_averia: v.descripcion_averia as string | null,
          est_resolucion_at: v.est_resolucion_at as string | null,
          repartidor:        v.repartidores
            ? { nombre: (Array.isArray(v.repartidores) ? v.repartidores[0] : v.repartidores)?.nombre ?? '' }
            : null,
        }))}
        opsLog={(opsLogRaw as any[])}
      />
    </div>
  )
}
