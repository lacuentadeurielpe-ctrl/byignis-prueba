// PATCH /api/superadmin/tenants/[id]/plan — cambiar plan de un tenant
import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: ferreteriaId } = await params
  const { plan_id } = await request.json()
  if (!plan_id) return NextResponse.json({ error: 'plan_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  const { data: plan } = await admin.from('planes').select('id, nombre, creditos_mes').eq('id', plan_id).single()
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const [r1, r2] = await Promise.all([
    admin.from('ferreterias').update({ plan_id }).eq('id', ferreteriaId),
    admin.from('suscripciones').update({ plan_id, creditos_mes: plan.creditos_mes }).eq('ferreteria_id', ferreteriaId),
  ])

  if (r1.error || r2.error) {
    return NextResponse.json({ error: r1.error?.message ?? r2.error?.message }, { status: 500 })
  }

  await admin.from('superadmin_audit_log').insert({
    superadmin_id: session.superadminId,
    accion:        'cambiar_plan',
    recurso_tipo:  'tenant',
    recurso_id:    ferreteriaId,
    metadata:      { plan_id, plan_nombre: plan.nombre },
    ip:            request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ ok: true, plan_nombre: plan.nombre })
}
