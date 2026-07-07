import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { getContextoSucursal } from '@/lib/sucursales/contexto'

export const dynamic = 'force-dynamic'

// GET /api/sucursales — contexto de sucursal del usuario (para el selector)
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const contexto = await getContextoSucursal(supabase, session)

  const { data: f } = await supabase
    .from('ferreterias')
    .select('stock_por_local')
    .eq('id', session.ferreteriaId)
    .single()

  return NextResponse.json({ ...contexto, stockPorLocal: f?.stock_por_local ?? false })
}

// PATCH /api/sucursales — activa/desactiva el modo multi-sucursal (solo dueño)
export async function PATCH(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.rol !== 'dueno') {
    return NextResponse.json({ error: 'Solo el dueño puede cambiar el modo multi-sucursal' }, { status: 403 })
  }

  let body: { multiSucursal?: boolean; stockPorLocal?: boolean }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const supabase = await createClient()

  if (typeof body.multiSucursal === 'boolean') {
    const { error } = await supabase
      .from('ferreterias')
      .update({ multi_sucursal: body.multiSucursal })
      .eq('id', session.ferreteriaId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (typeof body.stockPorLocal === 'boolean') {
    if (body.stockPorLocal) {
      // Activar Modo B: siembra la distribución (stock actual → local principal)
      const { error } = await supabase.rpc('activar_stock_por_local', {
        p_ferreteria_id: session.ferreteriaId,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // Desactivar: se vuelve al stock global; la distribución queda guardada
      const { error } = await supabase
        .from('ferreterias')
        .update({ stock_por_local: false })
        .eq('id', session.ferreteriaId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (typeof body.multiSucursal !== 'boolean' && typeof body.stockPorLocal !== 'boolean') {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
