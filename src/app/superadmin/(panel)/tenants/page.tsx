import { createAdminClient } from '@/lib/supabase/admin'
import TenantsClient from './TenantsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createAdminClient()

  const [
    { data: ferreterias },
    { data: suscripciones },
    { data: pedidos }
  ] = await Promise.all([
    admin.from('ferreterias').select('id, nombre, telefono_whatsapp, estado_tenant, created_at').order('created_at', { ascending: false }),
    admin.from('suscripciones').select('ferreteria_id, estado'),
    admin.from('pedidos').select('ferreteria_id, total, costo_total').eq('estado', 'entregado')
  ])

  const suscMap = Object.fromEntries((suscripciones ?? []).map(s => [s.ferreteria_id, s.estado]))
  const pedidosAgrupados: Record<string, { ventas: number, profit: number }> = {}
  
  for (const ped of (pedidos ?? [])) {
    if (!pedidosAgrupados[ped.ferreteria_id]) {
      pedidosAgrupados[ped.ferreteria_id] = { ventas: 0, profit: 0 }
    }
    const venta = Number(ped.total) || 0
    const costo = Number(ped.costo_total) || 0
    pedidosAgrupados[ped.ferreteria_id].ventas += venta
    pedidosAgrupados[ped.ferreteria_id].profit += (venta - costo)
  }

  const tenants = (ferreterias ?? []).map(f => {
    return {
      id:                f.id,
      nombre:            f.nombre,
      telefono_whatsapp: f.telefono_whatsapp ?? '',
      created_at:        f.created_at,
      suscripcion:       suscMap[f.id] ?? 'restringido',
      ventas:            pedidosAgrupados[f.id]?.ventas ?? 0,
      profit:            pedidosAgrupados[f.id]?.profit ?? 0,
      espacio_mb:        0, // Pendiente: Calcular peso exacto del bucket
    }
  })

  return { tenants }
}

export default async function TenantsPage() {
  const { tenants } = await getData()
  return <TenantsClient tenants={tenants} />
}
