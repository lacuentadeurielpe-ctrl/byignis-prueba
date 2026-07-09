import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body: {
      empleadoId: string
      targetLocalId: string | null
      sourceLocalId: string | null
    } = await request.json()

    const { empleadoId, targetLocalId, sourceLocalId } = body

    if (!empleadoId) return NextResponse.json({ error: 'ID de empleado es requerido' }, { status: 400 })

    const { data: emp, error: empErr } = await supabase
      .from('miembros_ferreteria')
      .select('rol, local_id')
      .eq('id', empleadoId)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (empErr || !emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

    const isMultiRol = ['repartidor', 'admin', 'administrador', 'dueno'].includes(emp.rol?.toLowerCase() || '')

    if (!isMultiRol) {
      // Si no es multi-rol, solo puede tener 1 sucursal
      // Actualizamos el viejo local_id para legacy compatibility
      await supabase
        .from('miembros_ferreteria')
        .update({ local_id: targetLocalId })
        .eq('id', empleadoId)
      
      // Borramos de la pivot y agregamos la nueva
      await supabase
        .from('empleado_sucursal')
        .delete()
        .eq('empleado_id', empleadoId)

      if (targetLocalId) {
        await supabase
          .from('empleado_sucursal')
          .insert({
            ferreteria_id: session.ferreteriaId,
            empleado_id: empleadoId,
            local_id: targetLocalId,
          })
      }
      return NextResponse.json({ success: true, mode: 'single' })
    }

    // SI ES MULTI ROL:
    
    // Si viene de una columna (sourceLocalId) a OTRA sucursal (targetLocalId) => MOVE
    // Si viene de 'pool' a sucursal => ADD
    // Si viene de sucursal a 'pool' => REMOVE
    
    if (sourceLocalId && sourceLocalId !== 'pool') {
      // Remover de origen
      await supabase
        .from('empleado_sucursal')
        .delete()
        .eq('empleado_id', empleadoId)
        .eq('local_id', sourceLocalId)
    }

    if (targetLocalId && targetLocalId !== 'pool') {
      // Agregar al destino
      await supabase
        .from('empleado_sucursal')
        .insert({
          ferreteria_id: session.ferreteriaId,
          empleado_id: empleadoId,
          local_id: targetLocalId,
        })
    }

    return NextResponse.json({ success: true, mode: 'multi' })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
