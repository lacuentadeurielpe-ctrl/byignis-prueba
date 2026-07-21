import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSuperadminSession } from '@/lib/auth/superadmin'
import ClientDetail from './ClientDetail'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  noStore()
  const { id } = await params
  const session = await getSuperadminSession()
  if (!session) redirect('/superadmin/login')

  const supabase = createAdminClient()

  // 1. Obtener info de la ferreteria
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('id, nombre, email, telefono_whatsapp, created_at, owner_id, suscripciones(id, estado, plan_id, created_at, ciclo_fin, trial_otorgado_por, trial_otorgado_at, trial_renovaciones)')
    .eq('id', id)
    .single()

  if (!ferreteria) redirect('/superadmin/clientes')

  // 2. Obtener total de ventas y profit histórico
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('total, ganancia_estimada')
    .eq('ferreteria_id', id)
    .eq('estado', 'completado')

  let ventasTotales = 0
  let profitTotal = 0
  let totalPedidosCompletados = 0

  if (pedidos) {
    totalPedidosCompletados = pedidos.length
    pedidos.forEach(p => {
      ventasTotales += Number(p.total || 0)
      profitTotal += Number(p.ganancia_estimada || 0)
    })
  }

  // 3. Obtener el espacio ocupado usando nuestro nuevo RPC
  let espacioKb = 0
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('calcular_espacio_tenant_kb', { p_ferreteria_id: id })

  if (!rpcError && rpcData !== null) {
    espacioKb = Number(rpcData)
  }

  let suscripcion = null
  if (ferreteria.suscripciones) {
    if (Array.isArray(ferreteria.suscripciones)) {
      suscripcion = ferreteria.suscripciones[0] || null
    } else {
      suscripcion = ferreteria.suscripciones
    }
  }

  let ownerEmail = ferreteria.email
  if (ferreteria.owner_id) {
    const { data: userData } = await supabase.auth.admin.getUserById(ferreteria.owner_id)
    if (userData?.user?.email) {
      ownerEmail = userData.user.email
    }
  }

  const clientData = {
    id: ferreteria.id,
    nombre: ferreteria.nombre || 'Sin Nombre',
    email: ownerEmail || 'Sin Correo',
    telefono: ferreteria.telefono_whatsapp || 'Sin Teléfono',
    fecha_registro: ferreteria.created_at,
    kpis: {
      ventasTotales,
      profitTotal,
      totalPedidosCompletados,
      espacioKb
    },
    suscripcion: {
      id: suscripcion?.id,
      estado: suscripcion?.estado || 'suspendido',
      creadoEn: suscripcion?.created_at,
      cicloFin: suscripcion?.ciclo_fin ?? null,
      trialOtorgadoPor: suscripcion?.trial_otorgado_por ?? null,
      trialOtorgadoAt: suscripcion?.trial_otorgado_at ?? null,
      trialRenovaciones: suscripcion?.trial_renovaciones ?? 0,
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ClientDetail data={clientData} />
    </div>
  )
}
