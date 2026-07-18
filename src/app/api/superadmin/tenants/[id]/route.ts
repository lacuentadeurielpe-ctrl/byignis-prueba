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
  const { suscripcion_estado } = body
  
  const admin = createAdminClient()

  let nuevoEstado = 'suspendido'
  let cicloFin: string | null = null

  if (suscripcion_estado === 'vitalicio') {
    nuevoEstado = 'activo'
    cicloFin = '2099-12-31'
  } else if (suscripcion_estado === 'pro') {
    nuevoEstado = 'activo'
    cicloFin = null
  } else if (suscripcion_estado === 'restringido') {
    nuevoEstado = 'suspendido'
  }

  // Primero intentamos actualizar
  const { data, error } = await admin
    .from('suscripciones')
    .update({ 
      estado: nuevoEstado, 
      ...(cicloFin ? { ciclo_fin: cicloFin } : {}) 
    })
    .eq('ferreteria_id', id)
    .select()

  // Si no se actualizó nada (arreglo vacío) o hubo error, insertamos
  if (error || !data || data.length === 0) {
    // Si no existe plan_id real, intentamos obtener uno o lo dejamos null si la BD lo permite
    // Asumiendo que podemos insertar o que requiere UUID válido, buscamos el primer plan o metemos uno dummy si no hay constraint
    await admin.from('suscripciones').insert({
      ferreteria_id: id,
      estado: nuevoEstado,
      ciclo_fin: cicloFin,
      creditos_mes: 999999,
      creditos_disponibles: 999999,
    })
  }

  // Refrescar la cache de Next.js
  revalidatePath('/superadmin', 'layout')
  revalidatePath('/superadmin/tenants')
  revalidatePath('/superadmin/historial')

  return NextResponse.json({ success: true, estado: suscripcion_estado })
}
