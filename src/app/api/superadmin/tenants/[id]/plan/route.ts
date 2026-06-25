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

  const r1 = await admin.from('ferreterias').update({ plan_id }).eq('id', ferreteriaId)
  if (r1.error) return NextResponse.json({ error: r1.error.message }, { status: 500 })

  // UPSERT: crea la fila si no existe; si existe, solo actualiza plan_id y creditos_del_mes
  // sin tocar creditos_disponibles (no resetear saldo del tenant)
  const { data: susSistente } = await admin
    .from('suscripciones')
    .select('ferreteria_id')
    .eq('ferreteria_id', ferreteriaId)
    .maybeSingle()

  const r2 = susSistente
    ? await admin
        .from('suscripciones')
        .update({ plan_id, creditos_del_mes: plan.creditos_mes })
        .eq('ferreteria_id', ferreteriaId)
    : await admin
        .from('suscripciones')
        .insert({ ferreteria_id: ferreteriaId, plan_id, creditos_del_mes: plan.creditos_mes, creditos_disponibles: plan.creditos_mes })

  if (r2.error) return NextResponse.json({ error: r2.error.message }, { status: 500 })

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
