/**
 * POST /api/superadmin/tenants/[id]/trial
 *
 * Gestiona la prueba gratuita de un tenant. Desde la migración 118 el trial
 * ya NO es automático al registrarse: es una cortesía que el superadmin
 * otorga, renueva o retira desde el panel.
 *
 * Body: { accion: 'activar' | 'renovar' | 'desactivar' }
 *   activar    → estado 'trial', vence en TRIAL_DIAS días desde hoy
 *   renovar    → reinicia el vencimiento a TRIAL_DIAS desde hoy (+1 al contador)
 *   desactivar → estado 'suspendido' (el cliente cae al paywall de inmediato)
 */

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const TRIAL_DIAS = 3

/** Fecha en Lima (YYYY-MM-DD) desplazada N días. */
function fechaLima(offsetDias = 0): string {
  const ahora = new Date()
  const lima = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }))
  lima.setDate(lima.getDate() + offsetDias)
  return lima.toLocaleDateString('en-CA')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(request)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado — se requiere nivel admin' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const accion = body?.accion as 'activar' | 'renovar' | 'desactivar' | undefined

  if (!accion || !['activar', 'renovar', 'desactivar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Estado actual (para el contador de renovaciones y validaciones)
  const { data: actual } = await admin
    .from('suscripciones')
    .select('id, estado, trial_renovaciones')
    .eq('ferreteria_id', id)
    .maybeSingle()

  let campos: Record<string, unknown>

  if (accion === 'desactivar') {
    campos = {
      estado:        'suspendido',
      ciclo_fin:     null,
      proximo_cobro: null,
    }
  } else {
    // activar y renovar comparten el efecto: 3 días desde hoy.
    // La diferencia es el contador de renovaciones (auditoría).
    const esRenovacion = accion === 'renovar'
    campos = {
      estado:             'trial',
      ciclo_inicio:       fechaLima(0),
      ciclo_fin:          fechaLima(TRIAL_DIAS),
      proximo_cobro:      null,
      trial_otorgado_por: session.email,
      trial_otorgado_at:  new Date().toISOString(),
      trial_renovaciones: esRenovacion ? (actual?.trial_renovaciones ?? 0) + 1 : 0,
    }
  }

  campos.updated_at = new Date().toISOString()

  if (actual) {
    const { error } = await admin
      .from('suscripciones')
      .update(campos)
      .eq('ferreteria_id', id)

    if (error) {
      return NextResponse.json({ error: `Error actualizando: ${error.message}` }, { status: 500 })
    }
  } else {
    // Tenant sin fila de suscripción (registros previos al trigger)
    const { data: plan } = await admin
      .from('planes')
      .select('id')
      .eq('nombre', 'Todo Incluido')
      .maybeSingle()

    const { error } = await admin.from('suscripciones').insert({
      ferreteria_id:        id,
      plan_id:              plan?.id ?? null,
      creditos_del_mes:     999999,
      creditos_disponibles: 999999,
      creditos_extra:       0,
      ...campos,
    })

    if (error) {
      return NextResponse.json({ error: `Error creando suscripción: ${error.message}` }, { status: 500 })
    }
  }

  revalidatePath('/superadmin', 'layout')
  revalidatePath('/superadmin/clientes')
  revalidatePath(`/superadmin/clientes/${id}`)

  return NextResponse.json({
    success:   true,
    accion,
    estado:    accion === 'desactivar' ? 'suspendido' : 'trial',
    venceEl:   accion === 'desactivar' ? null : fechaLima(TRIAL_DIAS),
  })
}
