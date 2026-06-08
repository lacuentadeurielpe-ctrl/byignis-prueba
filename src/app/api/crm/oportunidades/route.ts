import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// GET /api/crm/oportunidades — listar oportunidades CRM
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const url = new URL(request.url)

  const clienteId = url.searchParams.get('clienteId')
  const estado = url.searchParams.get('estado')
  const sort = url.searchParams.get('sort') || 'created_at'
  const order = url.searchParams.get('order') || 'desc'
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  try {
    let query = supabase
      .from('crm_oportunidades')
      .select(`
        id, cliente_id, titulo, descripcion, estado, valor_estimado,
        probabilidad_cierre, fecha_cierre_estimada, vendedor_id, cotizacion_id,
        created_at, updated_at,
        clientes(id, nombre, telefono),
        vendedores:auth.users(id, email, user_metadata)
      `)
      .eq('ferreteria_id', session.ferreteriaId)

    if (clienteId) {
      query = query.eq('cliente_id', clienteId)
    }

    if (estado) {
      query = query.eq('estado', estado)
    }

    const { data, error } = await query
      .order(sort, { ascending: order === 'asc' })
      .range((page - 1) * limit, page * limit - 1)

    if (error) {
      console.error('Error fetching oportunidades:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data ?? [],
      page,
      limit,
    })
  } catch (err) {
    console.error('Error in GET /api/crm/oportunidades:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/crm/oportunidades — crear nueva oportunidad
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  try {
    const body = await request.json()
    const {
      cliente_id,
      titulo,
      descripcion,
      estado = 'lead',
      valor_estimado = 0,
      probabilidad_cierre = 50,
      fecha_cierre_estimada,
      vendedor_id,
      cotizacion_id,
    } = body

    // Validaciones
    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 })
    }

    if (!titulo || titulo.trim().length === 0) {
      return NextResponse.json({ error: 'titulo es requerido' }, { status: 400 })
    }

    const ESTADOS_VALIDOS = ['lead', 'negociacion', 'ganado', 'perdido']
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: 'estado inválido' }, { status: 400 })
    }

    if (probabilidad_cierre < 0 || probabilidad_cierre > 100) {
      return NextResponse.json({ error: 'probabilidad_cierre debe estar entre 0 y 100' }, { status: 400 })
    }

    // Verificar que cliente existe y pertenece a la ferretería
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', cliente_id)
      .eq('ferreteria_id', session.ferreteriaId)
      .single()

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const nuevaOportunidad = {
      ferreteria_id: session.ferreteriaId,
      cliente_id,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      estado,
      valor_estimado: parseFloat(valor_estimado) || 0,
      probabilidad_cierre: Math.max(0, Math.min(100, parseInt(probabilidad_cierre) || 50)),
      fecha_cierre_estimada: fecha_cierre_estimada || null,
      vendedor_id: vendedor_id || null,
      cotizacion_id: cotizacion_id || null,
    }

    const { data, error } = await supabase
      .from('crm_oportunidades')
      .insert([nuevaOportunidad])
      .select('id, cliente_id, titulo, descripcion, estado, valor_estimado, probabilidad_cierre, fecha_cierre_estimada, vendedor_id, cotizacion_id, created_at')
      .single()

    if (error) {
      console.error('Error creating oportunidad:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/crm/oportunidades:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
