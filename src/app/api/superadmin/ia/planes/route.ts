// GET  /api/superadmin/ia/planes — lista planes reales con análisis de costo IA
// POST /api/superadmin/ia/planes — crea un nuevo plan

import { NextResponse }           from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient }      from '@/lib/supabase/admin'
import { inicioDiaLima }          from '@/lib/tiempo'

export async function GET(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()
  const inicio30d = inicioDiaLima(-30)

  const [{ data: planes }, { data: suscripciones }, { data: movs }] = await Promise.all([
    admin
      .from('planes')
      .select('id, nombre, creditos_mes, precio_mensual, precio_exceso, activo, created_at')
      .order('precio_mensual', { ascending: true }),
    admin
      .from('suscripciones')
      .select('plan_id, ferreteria_id, estado'),
    admin
      .from('movimientos_creditos')
      .select('ferreteria_id, creditos_usados, costo_usd')
      .gte('created_at', inicio30d),
  ])

  // Contar suscripciones activas por plan
  const conteoPlan: Record<string, number> = {}
  const tenantsPorPlan: Record<string, Set<string>> = {}
  for (const s of suscripciones ?? []) {
    if (!s.plan_id) continue
    conteoPlan[s.plan_id] = (conteoPlan[s.plan_id] ?? 0) + 1
    if (!tenantsPorPlan[s.plan_id]) tenantsPorPlan[s.plan_id] = new Set()
    tenantsPorPlan[s.plan_id].add(s.ferreteria_id)
  }

  // Costo IA real últimos 30d por tenant
  const costoTenant: Record<string, number> = {}
  const creditosTenant: Record<string, number> = {}
  for (const m of movs ?? []) {
    const fid = m.ferreteria_id
    costoTenant[fid] = (costoTenant[fid] ?? 0) + Number(m.costo_usd ?? 0)
    creditosTenant[fid] = (creditosTenant[fid] ?? 0) + (m.creditos_usados ?? 0)
  }

  // Para cada plan: promedio de costo IA mensual de sus tenants activos
  const planesConAnalisis = (planes ?? []).map((plan) => {
    const tenants = Array.from(tenantsPorPlan[plan.id] ?? [])
    let costoPromedioUsd = 0
    if (tenants.length > 0) {
      const totalCosto = tenants.reduce((s, fid) => s + (costoTenant[fid] ?? 0), 0)
      costoPromedioUsd = totalCosto / tenants.length
    }
    return {
      ...plan,
      suscripciones_activas: conteoPlan[plan.id] ?? 0,
      costo_ia_promedio_usd: costoPromedioUsd,
    }
  })

  return NextResponse.json({ planes: planesConAnalisis })
}

export async function POST(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { nombre, creditos_mes, precio_mensual, precio_exceso } = body

  if (!nombre?.trim())           return NextResponse.json({ error: 'nombre es requerido' },    { status: 400 })
  if (Number(creditos_mes) <= 0) return NextResponse.json({ error: 'creditos_mes debe ser > 0' }, { status: 400 })
  if (Number(precio_mensual) < 0) return NextResponse.json({ error: 'precio_mensual debe ser ≥ 0' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('planes')
    .insert({
      nombre:         nombre.trim(),
      creditos_mes:   Number(creditos_mes),
      precio_mensual: Number(precio_mensual),
      precio_exceso:  Number(precio_exceso ?? 0),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data }, { status: 201 })
}
