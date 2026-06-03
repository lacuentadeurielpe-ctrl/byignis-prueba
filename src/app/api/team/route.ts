// GET /api/team — lista los miembros del equipo (solo dueno)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { checkPermiso } from '@/lib/auth/permisos'
import { SaasRepository } from '@/lib/db/repositories/saas'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!checkPermiso(session, 'gestionar_empleados')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const supabase = await createClient()
  const saasRepo = new SaasRepository(supabase)

  try {
    const data = await saasRepo.listarMiembros(session.ferreteriaId)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
