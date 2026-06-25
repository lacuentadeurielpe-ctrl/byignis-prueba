// POST /api/superadmin/tenants/bulk — acciones masivas sobre múltiples tenants
// Acciones soportadas: agregar_creditos | cambiar_plan | suspender | activar

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { agregarCreditos } from '@/lib/credits'

const ACCIONES = ['agregar_creditos', 'cambiar_plan', 'suspender', 'activar'] as const
type Accion = (typeof ACCIONES)[number]

export async function POST(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado — se requiere nivel admin' }, { status: 403 })

  const body = await request.json()
  const { accion, ids, creditos, motivo, plan_id } = body as {
    accion:   Accion
    ids:      string[]
    creditos?: number
    motivo?:  string
    plan_id?: string
  }

  if (!ACCIONES.includes(accion)) {
    return NextResponse.json({ error: `Acción inválida: ${accion}` }, { status: 400 })
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Se requiere al menos un tenant' }, { status: 400 })
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: 'Máximo 200 tenants por operación' }, { status: 400 })
  }

  const admin = createAdminClient()
  const errores: string[] = []

  if (accion === 'agregar_creditos') {
    const cantidad = Number(creditos ?? 0)
    if (!cantidad || cantidad <= 0 || cantidad > 100_000) {
      return NextResponse.json({ error: 'Cantidad de créditos inválida (1–100.000)' }, { status: 400 })
    }
    const MOTIVOS_VALIDOS = ['plan_mensual', 'recarga_manual', 'compensacion', 'trial']
    const motivoFinal = MOTIVOS_VALIDOS.includes(motivo ?? '') ? motivo! : 'recarga_manual'

    await Promise.allSettled(
      ids.map(async ferreteriaId => {
        try {
          await agregarCreditos({
            ferreteriaId,
            creditos: cantidad,
            motivo: motivoFinal,
            montoCobrado: 0,
            superadminId: session.superadminId,
          })
        } catch (e) {
          errores.push(`${ferreteriaId}: ${e instanceof Error ? e.message : String(e)}`)
        }
      })
    )
  } else if (accion === 'cambiar_plan') {
    if (!plan_id) return NextResponse.json({ error: 'Se requiere plan_id' }, { status: 400 })

    const { data: plan } = await admin.from('planes').select('id, nombre, creditos_mes').eq('id', plan_id).single()
    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    await Promise.allSettled(
      ids.map(async ferreteriaId => {
        const { error: errF } = await admin
          .from('ferreterias')
          .update({ plan_id })
          .eq('id', ferreteriaId)

        // UPSERT: crea si no existe; actualiza sin resetear creditos_disponibles
        const { data: susEx } = await admin
          .from('suscripciones')
          .select('ferreteria_id')
          .eq('ferreteria_id', ferreteriaId)
          .maybeSingle()

        const r2 = susEx
          ? await admin
              .from('suscripciones')
              .update({ plan_id, creditos_del_mes: plan.creditos_mes })
              .eq('ferreteria_id', ferreteriaId)
          : await admin
              .from('suscripciones')
              .insert({ ferreteria_id: ferreteriaId, plan_id, creditos_del_mes: plan.creditos_mes, creditos_disponibles: plan.creditos_mes })

        if (errF || r2.error) errores.push(ferreteriaId)
      })
    )
  } else if (accion === 'suspender' || accion === 'activar') {
    const estado_tenant = accion === 'suspender' ? 'suspendido' : 'activo'
    const extra: Record<string, unknown> = { estado_tenant }
    if (accion === 'suspender') {
      extra.suspendido_at     = new Date().toISOString()
      extra.suspendido_motivo = 'Suspensión masiva por superadmin'
    } else {
      extra.suspendido_at     = null
      extra.suspendido_motivo = null
    }

    const { error } = await admin
      .from('ferreterias')
      .update(extra)
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Registrar auditoría
  await admin.from('superadmin_audit_log').insert({
    superadmin_id: session.superadminId,
    accion:        `bulk_${accion}`,
    recurso_tipo:  'tenant',
    recurso_id:    ids.join(','),
    metadata:      { ids, creditos, plan_id, motivo, total: ids.length },
    ip:            request.headers.get('x-forwarded-for') ?? undefined,
  })

  if (errores.length > 0) {
    return NextResponse.json({ ok: false, errores }, { status: 207 })
  }

  return NextResponse.json({ ok: true, total: ids.length })
}
