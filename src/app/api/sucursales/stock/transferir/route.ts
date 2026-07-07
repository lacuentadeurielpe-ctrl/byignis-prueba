import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { checkPermiso } from '@/lib/auth/permisos'
import { getContextoSucursal } from '@/lib/sucursales/contexto'

export const dynamic = 'force-dynamic'

// POST /api/sucursales/stock/transferir
// body: { localOrigen, localDestino, items: [{producto_id, cantidad}] }
// Atómico (RPC transferir_stock): valida pertenencia al tenant, stock
// suficiente con lock de fila, y deja registro en transferencias_stock.
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!checkPermiso(session, 'ver_stock')) {
    return NextResponse.json({ error: 'Sin permiso para mover stock' }, { status: 403 })
  }

  let body: {
    localOrigen?: string
    localDestino?: string
    items?: { producto_id: string; cantidad: number }[]
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (!body.localOrigen || !body.localDestino || !body.items?.length) {
    return NextResponse.json({ error: 'localOrigen, localDestino e items son requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  // El usuario debe poder operar AMBAS sucursales (un empleado fijado a una
  // sucursal no puede sacar stock de otra).
  const contexto = await getContextoSucursal(supabase, session)
  const visibles = new Set(contexto.localesVisibles.map(l => l.id))
  if (!visibles.has(body.localOrigen) || !visibles.has(body.localDestino)) {
    return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('transferir_stock', {
    p_ferreteria_id: session.ferreteriaId,
    p_local_origen:  body.localOrigen,
    p_local_destino: body.localDestino,
    p_items:         body.items,
    p_creado_por:    session.userId,
  })

  if (error) {
    // Los RAISE EXCEPTION del RPC llegan como mensaje legible
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  return NextResponse.json({ ok: true, transferenciaId: data })
}
