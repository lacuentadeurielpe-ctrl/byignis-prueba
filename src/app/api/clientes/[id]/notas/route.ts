import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// GET /api/clientes/[id]/notas — listar notas de cliente
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  try {
    // Verificar que el cliente existe y pertenece a la ferretería
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('cliente_notas')
      .select(`
        id, tipo, contenido, created_at,
        autor:auth.users(id, email, user_metadata)
      `)
      .eq('cliente_id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('Error in GET /api/clientes/[id]/notas:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/clientes/[id]/notas — crear nueva nota
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id } = await params

  try {
    const body = await request.json()
    const { contenido, tipo = 'nota' } = body

    // Validaciones
    if (!contenido || contenido.trim().length === 0) {
      return NextResponse.json({ error: 'contenido es requerido' }, { status: 400 })
    }

    const TIPOS_VALIDOS = ['nota', 'llamada', 'reunion', 'whatsapp']
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }

    // Verificar que el cliente existe y pertenece a la ferretería
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const nuevaNota = {
      ferreteria_id: session.ferreteriaId,
      cliente_id: id,
      autor_id: session.userId,
      tipo,
      contenido: contenido.trim(),
    }

    const { data, error } = await supabase
      .from('cliente_notas')
      .insert([nuevaNota])
      .select('id, tipo, contenido, created_at')
      .single()

    if (error) {
      console.error('Error creating nota:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/clientes/[id]/notas:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
