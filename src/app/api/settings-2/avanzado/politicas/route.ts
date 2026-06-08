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
      .from('ferreterias')
      .select('permitir_venta_sin_stock, requiere_aprobacion_credito, margen_minimo_descuento')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching politicas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET /api/settings-2/avanzado/politicas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    const updateData: Record<string, any> = {}
    if (body.permitir_venta_sin_stock !== undefined) updateData.permitir_venta_sin_stock = body.permitir_venta_sin_stock
    if (body.requiere_aprobacion_credito !== undefined) updateData.requiere_aprobacion_credito = body.requiere_aprobacion_credito
    if (body.margen_minimo_descuento !== undefined) updateData.margen_minimo_descuento = body.margen_minimo_descuento

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updateData)
      .eq('id', session.ferreteriaId)
      .select('permitir_venta_sin_stock, requiere_aprobacion_credito, margen_minimo_descuento')
      .single()

    if (error) {
      console.error('Error updating politicas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/avanzado/politicas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
