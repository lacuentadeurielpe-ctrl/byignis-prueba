import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/superadmin/planes/[id]/funciones
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: planId } = await params
  const admin = createAdminClient()

  const { data: funciones, error: errF } = await admin
    .from('funciones_plataforma')
    .select('id, clave, nombre, modulo, descripcion, orden')
    .order('modulo').order('orden')

  if (errF) return NextResponse.json({ error: errF.message }, { status: 500 })

  const { data: asignadas } = await admin
    .from('plan_funciones')
    .select('funcion_id, habilitada')
    .eq('plan_id', planId)

  const asignadasSet = new Set(
    (asignadas ?? []).filter(a => a.habilitada).map(a => a.funcion_id)
  )

  const resultado = (funciones ?? []).map(f => ({
    ...f,
    habilitada: asignadasSet.has(f.id),
  }))

  return NextResponse.json({ funciones: resultado })
}

// PATCH /api/superadmin/planes/[id]/funciones
// Body: { funcion_id: string, habilitada: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperadminAdmin(req)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: planId } = await params
  const body = await req.json()
  const { funcion_id, habilitada } = body as { funcion_id: string; habilitada: boolean }

  if (!funcion_id || typeof habilitada !== 'boolean') {
    return NextResponse.json({ error: 'funcion_id y habilitada son requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (habilitada) {
    const { error } = await admin
      .from('plan_funciones')
      .upsert({ plan_id: planId, funcion_id, habilitada: true }, { onConflict: 'plan_id,funcion_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin
      .from('plan_funciones')
      .delete()
      .eq('plan_id', planId)
      .eq('funcion_id', funcion_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
