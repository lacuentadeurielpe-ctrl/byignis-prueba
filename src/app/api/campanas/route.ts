import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/campanas
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('campanas')
    .select('*, plantillas_wa(id, nombre, meta_status)')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/campanas — crear campaña
export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, plantilla_id, mensaje_libre, filtro_tags, filtro_tipo, acepta_mkt_only, programada_at } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  if (!plantilla_id && !mensaje_libre?.trim()) {
    return NextResponse.json({ error: 'Requiere plantilla o mensaje' }, { status: 400 })
  }

  const supabase = await createClient()

  // Contar destinatarios según filtros
  let clientesQuery = supabase
    .from('clientes')
    .select('id', { count: 'exact', head: true })
    .eq('ferreteria_id', session.ferreteriaId)
    .not('telefono', 'is', null)

  if (acepta_mkt_only !== false) clientesQuery = clientesQuery.eq('acepta_marketing', true)
  if (filtro_tipo) clientesQuery = clientesQuery.eq('tipo', filtro_tipo)
  if (filtro_tags?.length) clientesQuery = clientesQuery.overlaps('tags', filtro_tags)

  const { count: total_destinos } = await clientesQuery

  const { data, error } = await supabase
    .from('campanas')
    .insert({
      ferreteria_id:   session.ferreteriaId,
      nombre:          nombre.trim(),
      plantilla_id:    plantilla_id ?? null,
      mensaje_libre:   mensaje_libre ?? null,
      filtro_tags:     filtro_tags ?? [],
      filtro_tipo:     filtro_tipo ?? null,
      acepta_mkt_only: acepta_mkt_only ?? true,
      programada_at:   programada_at ?? null,
      total_destinos:  total_destinos ?? 0,
      creado_por:      session.userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
