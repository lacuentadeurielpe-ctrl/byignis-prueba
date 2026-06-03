// PATCH /api/team/[id] — activa o desactiva un miembro (solo dueno)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { checkPermiso } from '@/lib/auth/permisos'
import { SaasRepository } from '@/lib/db/repositories/saas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!checkPermiso(session, 'gestionar_empleados')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()
  const saasRepo = new SaasRepository(supabase)

  try {
    const data = await saasRepo.actualizarMiembroActivo(session.ferreteriaId, id, body.activo)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
