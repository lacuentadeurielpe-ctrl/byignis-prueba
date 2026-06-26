import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/respuestas-rapidas?q=...
export async function GET(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q') ?? ''
  const supabase = await createClient()

  let query = supabase
    .from('respuestas_rapidas')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('orden')
    .order('atajo')

  if (q) query = query.ilike('atajo', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/respuestas-rapidas — { atajo, contenido, categoria? }
export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { atajo, contenido, categoria } = await req.json()
  if (!atajo?.trim() || !contenido?.trim()) {
    return NextResponse.json({ error: 'atajo y contenido requeridos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('respuestas_rapidas')
    .insert({
      ferreteria_id: session.ferreteriaId,
      atajo: atajo.trim().toLowerCase(),
      contenido: contenido.trim(),
      categoria: categoria ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
