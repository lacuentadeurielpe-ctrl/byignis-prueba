import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/plantillas-wa
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('plantillas_wa')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/plantillas-wa
export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, categoria, idioma, header_tipo, header_contenido, cuerpo, footer, botones, variables } = body

  if (!nombre?.trim() || !cuerpo?.trim()) {
    return NextResponse.json({ error: 'nombre y cuerpo requeridos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('plantillas_wa')
    .insert({
      ferreteria_id: session.ferreteriaId,
      nombre: nombre.trim(),
      categoria: categoria ?? 'MARKETING',
      idioma: idioma ?? 'es',
      header_tipo: header_tipo ?? null,
      header_contenido: header_contenido ?? null,
      cuerpo: cuerpo.trim(),
      footer: footer ?? null,
      botones: botones ?? [],
      variables: variables ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
