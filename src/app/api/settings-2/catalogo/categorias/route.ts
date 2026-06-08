import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('categorias_producto')
      .select('id, nombre, descripcion, icono, orden')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('orden', { ascending: true })

    if (error) {
      console.error('Error fetching categorias:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/catalogo/categorias:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.nombre) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('categorias_producto')
      .insert({
        ferreteria_id: session.ferreteriaId,
        nombre: body.nombre,
        descripcion: body.descripcion || '',
        icono: body.icono || '📦',
        orden: body.orden || 999,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating categoria:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/catalogo/categorias:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const categoriaId = searchParams.get('id')

    if (!categoriaId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('categorias_producto')
      .delete()
      .eq('id', categoriaId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting categoria:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/catalogo/categorias:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
