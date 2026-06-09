import { createClient } from '@supabase/supabase-js'
import { Truck } from 'lucide-react'
import DeliveryView from './DeliveryView'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'

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

  const [pedidos, cobrosHoy] = await Promise.all([
    deliveryRepo.obtenerPedidosAsignadosRepartidor(repartidor.ferreteria_id, repartidor.id),
    deliveryRepo.obtenerCobrosHoyRepartidor(repartidor.ferreteria_id, repartidor.id, hoy),
  ])

  let pedidosDisponibles: any[] = []
  if (modo === 'libre') {
    pedidosDisponibles = await deliveryRepo.obtenerPedidosDisponiblesReparto(repartidor.ferreteria_id)
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
