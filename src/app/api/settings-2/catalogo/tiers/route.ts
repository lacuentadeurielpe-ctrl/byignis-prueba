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
      .from('descuentos_tiers')
      .select('id, cantidad_minima, descuento_porcentaje, precio_fijo')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('cantidad_minima', { ascending: true })

    if (error) {
      console.error('Error fetching tiers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/settings-2/catalogo/tiers:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    if (body.cantidad_minima === undefined) {
      return NextResponse.json({ error: 'Cantidad mínima es requerida' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('descuentos_tiers')
      .insert({
        ferreteria_id: session.ferreteriaId,
        cantidad_minima: body.cantidad_minima,
        descuento_porcentaje: body.descuento_porcentaje || 0,
        precio_fijo: body.precio_fijo || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tier:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in POST /api/settings-2/catalogo/tiers:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const tierId = searchParams.get('id')

    if (!tierId) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('descuentos_tiers')
      .delete()
      .eq('id', tierId)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) {
      console.error('Error deleting tier:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/settings-2/catalogo/tiers:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
