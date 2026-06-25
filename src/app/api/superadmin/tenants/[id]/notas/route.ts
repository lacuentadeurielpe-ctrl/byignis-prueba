// PATCH /api/superadmin/tenants/[id]/notas — guardar notas internas del superadmin
import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: ferreteriaId } = await params
  const { notas_internas } = await request.json()

  const admin = createAdminClient()
  const { error } = await admin
    .from('ferreterias')
    .update({ notas_internas: notas_internas ?? null })
    .eq('id', ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
