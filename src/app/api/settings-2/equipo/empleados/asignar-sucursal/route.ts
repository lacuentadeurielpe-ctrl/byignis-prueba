import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { checkPermiso } from '@/lib/auth/permisos'

export const dynamic = 'force-dynamic'

// Roles que pueden estar en múltiples sucursales simultáneamente.
// ⚠️ KEEP IN SYNC with RolesBoard.tsx ROLES_MULTI_SUCURSAL
export const ROLES_MULTI_SUCURSAL = ['repartidor', 'admin', 'administrador', 'dueno', 'gerente']

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Solo dueños o empleados con gestionar_empleados pueden reasignar sucursales
  if (session.rol !== 'dueno' && !checkPermiso(session, 'gestionar_empleados')) {
    return NextResponse.json({ error: 'Sin permiso para gestionar empleados' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const body: {
      empleadoId: string
      targetLocalId: string | null
      sourceLocalId: string | null
    } = await request.json()

    const { empleadoId, targetLocalId, sourceLocalId } = body

    if (!empleadoId) return NextResponse.json({ error: 'ID de empleado es requerido' }, { status: 400 })

    // [FIX #4] Rechazar el local virtual 'principal' que no existe en DB
    if (targetLocalId === 'principal' || sourceLocalId === 'principal') {
      return NextResponse.json({ error: 'Esta ferretería aún no tiene sucursales configuradas' }, { status: 400 })
    }

    // Verificar que el empleado pertenece a esta ferretería (FIX #1 — ferreteria_id en fetch)
    const { data: emp, error: empErr } = await supabase
      .from('miembros_ferreteria')
      .select('rol, local_id')
      .eq('id', empleadoId)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (empErr || !emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

    // [FIX #2] Validar que targetLocalId pertenece a esta ferretería
    if (targetLocalId) {
      const { data: localTarget } = await supabase
        .from('locales_ferreteria')
        .select('id')
        .eq('id', targetLocalId)
        .eq('ferreteria_id', session.ferreteriaId)
        .single()
      if (!localTarget) return NextResponse.json({ error: 'Sucursal destino no válida' }, { status: 400 })
    }

    // [FIX #2] Validar que sourceLocalId pertenece a esta ferretería
    if (sourceLocalId) {
      const { data: localSource } = await supabase
        .from('locales_ferreteria')
        .select('id')
        .eq('id', sourceLocalId)
        .eq('ferreteria_id', session.ferreteriaId)
        .single()
      if (!localSource) return NextResponse.json({ error: 'Sucursal origen no válida' }, { status: 400 })
    }

    const isMultiRol = ROLES_MULTI_SUCURSAL.includes(emp.rol?.toLowerCase() || '')

    if (!isMultiRol) {
      // Trabajador de una sola sucursal: swap directo

      // [FIX #1] — ferreteria_id en UPDATE (antes solo filtraba por id)
      await supabase
        .from('miembros_ferreteria')
        .update({ local_id: targetLocalId })
        .eq('id', empleadoId)
        .eq('ferreteria_id', session.ferreteriaId)

      // Borrar pivot existente y agregar la nueva
      await supabase
        .from('empleado_sucursal')
        .delete()
        .eq('empleado_id', empleadoId)
        .eq('ferreteria_id', session.ferreteriaId)

      if (targetLocalId) {
        // [FIX #8] — upsert con onConflict para evitar duplicados
        await supabase
          .from('empleado_sucursal')
          .upsert(
            { ferreteria_id: session.ferreteriaId, empleado_id: empleadoId, local_id: targetLocalId },
            { onConflict: 'empleado_id,local_id' },
          )
      }
      return NextResponse.json({ success: true, mode: 'single' })
    }

    // MULTI ROL: puede estar en varias sucursales
    // Si viene de una sucursal concreta → remover de origen
    if (sourceLocalId) {
      await supabase
        .from('empleado_sucursal')
        .delete()
        .eq('empleado_id', empleadoId)
        .eq('local_id', sourceLocalId)
        .eq('ferreteria_id', session.ferreteriaId)
    }

    // Si va a una sucursal concreta → agregar al destino (upsert para evitar duplicados)
    // [FIX #8]
    if (targetLocalId) {
      await supabase
        .from('empleado_sucursal')
        .upsert(
          { ferreteria_id: session.ferreteriaId, empleado_id: empleadoId, local_id: targetLocalId },
          { onConflict: 'empleado_id,local_id' },
        )
    }

    return NextResponse.json({ success: true, mode: 'multi' })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
