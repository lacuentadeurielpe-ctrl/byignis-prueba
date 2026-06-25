import { createAdminClient } from '@/lib/supabase/admin'
import TenantsClient from './TenantsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createAdminClient()

  const [{ data: ferreterias }, { data: suscripciones }, { data: planes }] = await Promise.all([
    admin.from('ferreterias').select('id, nombre, telefono_whatsapp, estado_tenant, created_at').order('created_at', { ascending: false }),
    admin.from('suscripciones').select('ferreteria_id, plan_id, estado, creditos_disponibles, creditos_mes'),
    admin.from('planes').select('id, nombre, precio_mensual'),
  ])

  const planesMap = Object.fromEntries((planes ?? []).map(p => [p.id, p]))
  const suscMap   = Object.fromEntries((suscripciones ?? []).map(s => [s.ferreteria_id, s]))

  const tenants = (ferreterias ?? []).map(f => {
    const sus   = suscMap[f.id]
    const plan  = sus?.plan_id ? planesMap[sus.plan_id] : null
    const mrr   = plan?.precio_mensual && sus?.estado === 'activo' ? Number(plan.precio_mensual) : 0
    return {
      id:                f.id,
      nombre:            f.nombre,
      telefono_whatsapp: f.telefono_whatsapp ?? '',
      estado_tenant:     f.estado_tenant ?? 'trial',
      created_at:        f.created_at,
      plan_nombre:       plan?.nombre ?? null,
      plan_id:           sus?.plan_id ?? null,
      creditos_disp:     sus?.creditos_disponibles ?? 0,
      creditos_mes:      sus?.creditos_mes ?? 0,
      mrr,
    }
  })

  const plansList = (planes ?? []).map(p => ({ id: p.id, nombre: p.nombre }))

  return { tenants, planes: plansList }
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const params           = await searchParams
  const { tenants, planes } = await getData()

  return (
    <TenantsClient
      tenants={tenants}
      planes={planes}
      filtroInicial={params.filtro ?? ''}
    />
  )
}
