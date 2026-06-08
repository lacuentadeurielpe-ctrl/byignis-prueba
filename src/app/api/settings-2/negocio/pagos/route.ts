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
      .select('metodos_pago_activos, datos_yape, datos_plin, datos_transferencia')
      .eq('id', session.ferreteriaId)
      .single()

    if (error) {
      console.error('Error fetching pagos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {})
  } catch (err) {
    console.error('Error in GET /api/settings-2/negocio/pagos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json()

    // Validar metodos_pago_activos
    const METODOS_VALIDOS = ['efectivo', 'yape', 'plin', 'transferencia', 'mercadopago']
    if (body.metodos_pago_activos !== undefined) {
      const metodos = body.metodos_pago_activos as string[]
      if (!Array.isArray(metodos) || !metodos.every(m => METODOS_VALIDOS.includes(m))) {
        return NextResponse.json({ error: 'Métodos de pago inválidos' }, { status: 400 })
      }
    }

    const updateData: Record<string, any> = {}
    if (body.metodos_pago_activos !== undefined) updateData.metodos_pago_activos = body.metodos_pago_activos
    if (body.datos_yape !== undefined) updateData.datos_yape = body.datos_yape
    if (body.datos_plin !== undefined) updateData.datos_plin = body.datos_plin
    if (body.datos_transferencia !== undefined) updateData.datos_transferencia = body.datos_transferencia

    const { data, error } = await supabase
      .from('ferreterias')
      .update(updateData)
      .eq('id', session.ferreteriaId)
      .select('metodos_pago_activos, datos_yape, datos_plin, datos_transferencia')
      .single()

    if (error) {
      console.error('Error updating pagos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error in PATCH /api/settings-2/negocio/pagos:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
