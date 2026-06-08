import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

// GET /api/pedido-estados — Catálogo global de estados de pedido (slug + metadata)
// Fuente de verdad para labels/colores. Agregar un estado = 1 fila en la tabla.
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pedido_estados')
    .select('slug, nombre, orden, color, icono, es_final')
    .order('orden', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
