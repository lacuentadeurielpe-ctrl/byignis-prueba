// PATCH /api/superadmin/tenants/[id]  — actualizar estado de suscripcion
import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado — se requiere nivel admin' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { estadoSuscripcion } = body
  
  const admin = createAdminClient()

  const nuevoEstado = estadoSuscripcion // activo, suspendido, trial
  let cicloFin: string | null = null

  if (estadoSuscripcion === 'activo') {
    cicloFin = '2099-12-31' // Plan vitalicio/pro
  } else if (estadoSuscripcion === 'trial') {
    // El trial dura 3 días desde hoy (Lima). Sin esto heredaba el ciclo_fin
    // anterior — por ejemplo 2099-12-31 — creando pruebas de décadas.
    const lima = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }))
    lima.setDate(lima.getDate() + 3)
    cicloFin = lima.toLocaleDateString('en-CA')
  }

  // Primero intentamos actualizar
  const { data, error: updateError } = await admin
    .from('suscripciones')
    .update({
      estado: nuevoEstado,
      ...(cicloFin ? { ciclo_fin: cicloFin } : {}),
    })
    .eq('ferreteria_id', id)
    .select()

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Si no se actualizó nada (arreglo vacío), insertamos
  if (!data || data.length === 0) {
    const { error: insertError } = await admin.from('suscripciones').insert({
      ferreteria_id: id,
      estado: nuevoEstado,
      ciclo_fin: cicloFin,
      creditos_del_mes: 999999, // Fix column name
      creditos_disponibles: 999999,
      creditos_extra: 0,
      plan_id: '2cb9bb87-c734-4374-92e0-2d37d010eb2e' // Plan Pro por defecto
    })
    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Refrescar la cache de Next.js
  revalidatePath('/superadmin', 'layout')
  revalidatePath('/superadmin/clientes')
  revalidatePath(`/superadmin/clientes/${id}`)

  return NextResponse.json({ success: true, estado: estadoSuscripcion })
}
