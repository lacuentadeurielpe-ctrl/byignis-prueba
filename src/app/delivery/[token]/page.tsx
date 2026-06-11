import { createClient } from '@supabase/supabase-js'
import { Truck } from 'lucide-react'
import DeliveryView from './DeliveryView'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'
import type { SupabaseClient } from '@supabase/supabase-js'

// Calcula crédito disponible por cliente para los pedidos de la lista
async function enriquecerPedidosConCredito(supabase: SupabaseClient, pedidos: any[]) {
  const clienteIds = [...new Set(pedidos.map(p => p.cliente_id).filter(Boolean))] as string[]
  if (!clienteIds.length) return pedidos

  // Clientes que tienen límite configurado
  const { data: clientesConLimite } = await supabase
    .from('clientes')
    .select('id, limite_credito_monto')
    .in('id', clienteIds)
    .not('limite_credito_monto', 'is', null)

  if (!clientesConLimite?.length) return pedidos

  // Deudas activas/vencidas de esos clientes
  const { data: deudasActivas } = await supabase
    .from('creditos')
    .select('cliente_id, monto_total, monto_pagado')
    .in('cliente_id', clientesConLimite.map(c => c.id))
    .in('estado', ['activo', 'vencido'])

  // Mapa: cliente_id → crédito disponible
  const creditoMap: Record<string, number> = {}
  for (const c of clientesConLimite) {
    const deudaTotal = (deudasActivas ?? [])
      .filter(d => d.cliente_id === c.id)
      .reduce((s: number, d: any) => s + Math.max(0, d.monto_total - d.monto_pagado), 0)
    creditoMap[c.id] = Math.max(0, (c.limite_credito_monto as number) - deudaTotal)
  }

  return pedidos.map(p => ({
    ...p,
    credito_disponible: p.cliente_id && creditoMap[p.cliente_id] !== undefined
      ? creditoMap[p.cliente_id]
      : null,
  }))
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  params: Promise<{ token: string }>
}

export default async function DeliveryPage({ params }: Props) {
  const { token } = await params
  const supabase = adminClient()
  const deliveryRepo = new DeliveryRepository(supabase)

  const repartidor = await deliveryRepo.obtenerRepartidorPorToken(token)

  if (!repartidor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-700">Enlace inválido</h1>
          <p className="text-sm text-gray-400 mt-1">Este enlace no existe o fue desactivado.</p>
        </div>
      </div>
    )
  }

  const ferr = repartidor.ferreterias as any
  const ferreteriaNombre = ferr?.nombre ?? 'Empresa'
  const modo: 'manual' | 'libre' = ferr?.modo_asignacion_delivery === 'libre' ? 'libre' : 'manual'
  // Fecha actual en zona Lima (UTC-5) para filtrar cobros del día correcto
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

  const [pedidosRaw, cobrosHoy] = await Promise.all([
    deliveryRepo.obtenerPedidosAsignadosRepartidor(repartidor.ferreteria_id, repartidor.id),
    deliveryRepo.obtenerCobrosHoyRepartidor(repartidor.ferreteria_id, repartidor.id, hoy),
  ])

  // Enriquecer con crédito disponible del cliente (2 queries batch, no N+1)
  const pedidos = await enriquecerPedidosConCredito(supabase, pedidosRaw as any[])

  let pedidosDisponibles: any[] = []
  if (modo === 'libre') {
    const disponiblesRaw = await deliveryRepo.obtenerPedidosDisponiblesReparto(repartidor.ferreteria_id)
    pedidosDisponibles = await enriquecerPedidosConCredito(supabase, disponiblesRaw as any[])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header y contador reactivos viven dentro de DeliveryView (client component)
          para que el contador se actualice al confirmar entregas sin recargar la página. */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <DeliveryView
          pedidos={(pedidos ?? []) as any}
          pedidosDisponibles={(pedidosDisponibles ?? []) as any}
          cobrosHoy={(cobrosHoy ?? []) as any}
          token={token}
          modo={modo}
          puedeRegistrarDeuda={repartidor.puede_registrar_deuda ?? false}
          tienePin={!!(repartidor as unknown as { pin_hash?: string | null }).pin_hash}
          nombre={repartidor.nombre}
          ferreteriaNombre={ferreteriaNombre}
        />
      </div>
    </div>
  )
}
