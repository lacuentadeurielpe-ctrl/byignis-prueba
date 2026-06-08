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
      .from('productos_complementarios')
      .select('id, producto_id, orden, activo')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('orden', { ascending: true })

    if (error) {
      console.error('Error fetching complementarios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/bot/complementarios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (!body.producto_id) {
      return NextResponse.json({ error: 'Producto es requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('productos_complementarios')
      .insert({
        ferreteria_id: session.ferreteriaId,
        producto_id: body.producto_id,
        orden: body.orden || 999,
        activo: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating complementario:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/bot/complementarios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const complementarioId = searchParams.get('id')

    if (!complementarioId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('productos_complementarios')
      .delete()
      .eq('id', complementarioId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting complementario:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/bot/complementarios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
