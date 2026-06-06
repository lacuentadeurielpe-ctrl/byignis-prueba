import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { contenido, tipo } = await req.json()
    if (!contenido || !tipo) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
    }

    const supabase = await createClient()

    // Insertar
    const { data, error } = await supabase.from('cliente_notas').insert({
      ferreteria_id: session.ferreteriaId,
      cliente_id: id,
      autor_id: session.userId,
      tipo,
      contenido
    }).select().single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Error guardando nota de cliente:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
