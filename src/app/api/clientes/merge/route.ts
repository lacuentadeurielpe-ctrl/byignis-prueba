import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.rol !== 'dueno') {
    return NextResponse.json({ error: 'Solo el dueño puede fusionar clientes' }, { status: 403 })
  }

  const { idPrincipal, idSecundario } = await request.json()

  if (!idPrincipal || !idSecundario || idPrincipal === idSecundario) {
    return NextResponse.json({ error: 'IDs inválidos para fusión' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Verificar que ambos clientes existen y pertenecen a la ferretería
  const { data: clientes, error: errC } = await supabase
    .from('clientes')
    .select('id')
    .eq('ferreteria_id', session.ferreteriaId)
    .in('id', [idPrincipal, idSecundario])

  if (errC || !clientes || clientes.length !== 2) {
    return NextResponse.json({ error: 'Uno o ambos clientes no existen o no tienes acceso' }, { status: 404 })
  }

  // 2. Transacciones no existen en el cliente JS de Supabase nativo sin RPC, 
  // así que lo haremos secuencialmente. 
  // Reasignar Pedidos
  await supabase
    .from('pedidos')
    .update({ cliente_id: idPrincipal })
    .eq('cliente_id', idSecundario)
    .eq('ferreteria_id', session.ferreteriaId)

  // Reasignar Cotizaciones
  await supabase
    .from('cotizaciones')
    .update({ cliente_id: idPrincipal })
    .eq('cliente_id', idSecundario)
    .eq('ferreteria_id', session.ferreteriaId)

  // Reasignar Créditos
  await supabase
    .from('creditos')
    .update({ cliente_id: idPrincipal })
    .eq('cliente_id', idSecundario)
    .eq('ferreteria_id', session.ferreteriaId)

  // Reasignar Conversaciones
  // Problema: Podría haber 2 conversaciones activas. Las pasamos todas al principal.
  await supabase
    .from('conversaciones')
    .update({ cliente_id: idPrincipal })
    .eq('cliente_id', idSecundario)
    .eq('ferreteria_id', session.ferreteriaId)

  // 3. Eliminar el cliente secundario
  const { error: errDel } = await supabase
    .from('clientes')
    .delete()
    .eq('id', idSecundario)
    .eq('ferreteria_id', session.ferreteriaId)

  if (errDel) {
    return NextResponse.json({ error: 'No se pudo eliminar el cliente secundario después de migrar datos: ' + errDel.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
