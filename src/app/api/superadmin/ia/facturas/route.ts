// GET /api/superadmin/ia/facturas  — lista facturas de gasto IA

import { NextResponse } from 'next/server'
import { requireSuperadminAdmin } from '@/lib/auth/superadmin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const session = await requireSuperadminAdmin(request)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('facturas_gasto_ia')
    .select('*')
    .order('periodo_inicio', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ facturas: data })
}
