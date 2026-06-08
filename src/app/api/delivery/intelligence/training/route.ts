/**
 * GET  /api/delivery/intelligence/training — paginated predictions with outcomes
 * PATCH /api/delivery/intelligence/training — owner adjusts/marks a prediction
 */

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const onlyCompleted = searchParams.get('completed') === 'true'

  const supabase = await createClient()

  let query = supabase
    .from('delivery_predictions')
    .select('*, zonas_delivery(nombre)', { count: 'exact' })
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (onlyCompleted) {
    query = query.not('duracion_real_min', 'is', null)
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    predictions: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  })
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { predictionId, feedback } = body

  if (!predictionId || !feedback) {
    return NextResponse.json({ error: 'predictionId y feedback requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('delivery_predictions')
    .update({ owner_feedback: feedback })
    .eq('id', predictionId)
    .eq('ferreteria_id', session.ferreteriaId)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Predicción no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
