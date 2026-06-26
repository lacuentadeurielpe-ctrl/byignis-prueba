import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

type Params = { params: Promise<{ id: string }> }

// POST /api/bandeja/[id]/leer — marca conversación como leída
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('conversaciones')
    .update({ no_leido_count: 0, ultima_lectura_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
