/**
 * GET /api/delivery/events?entregaId=xxx
 * Event log for a specific delivery
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const entregaId = searchParams.get('entregaId')

  const supabase = await createClient()

  let query = supabase
    .from('delivery_events')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (entregaId) {
    query = query.eq('entrega_id', entregaId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
