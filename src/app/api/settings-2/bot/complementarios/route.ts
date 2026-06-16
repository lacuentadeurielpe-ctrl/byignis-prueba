import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

type TipoCatalogo = 'fisico' | 'digital'

async function resolverNombres(
  supabase: any,
  ferreteriaId: string,
  ids: { id: string; tipo: TipoCatalogo }[]
): Promise<Map<string, { nombre: string; precio: number }>> {
  const mapa = new Map<string, { nombre: string; precio: number }>()
  const idsFisicos = ids.filter((i) => i.tipo === 'fisico').map((i) => i.id)
  const idsDigitales = ids.filter((i) => i.tipo === 'digital').map((i) => i.id)

  const [{ data: fisicos }, { data: digitales }] = await Promise.all([
    idsFisicos.length
      ? supabase.from('productos').select('id, nombre, precio_base').eq('ferreteria_id', ferreteriaId).in('id', idsFisicos)
      : Promise.resolve({ data: [] }),
    idsDigitales.length
      ? supabase.from('productos_digitales').select('id, nombre, precio').eq('ferreteria_id', ferreteriaId).in('id', idsDigitales)
      : Promise.resolve({ data: [] }),
  ])

  for (const p of fisicos ?? []) mapa.set(p.id, { nombre: p.nombre, precio: p.precio_base })
  for (const p of digitales ?? []) mapa.set(p.id, { nombre: p.nombre, precio: p.precio })
  return mapa
}

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('productos_complementarios')
      .select('id, producto_id, producto_tipo, complementario_id, complementario_tipo, activo')
      .eq('ferreteria_id', session.ferreteriaId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching complementarios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const pares = data ?? []
    const nombres = await resolverNombres(supabase, session.ferreteriaId, [
      ...pares.map((p) => ({ id: p.producto_id, tipo: p.producto_tipo as TipoCatalogo })),
      ...pares.map((p) => ({ id: p.complementario_id, tipo: p.complementario_tipo as TipoCatalogo })),
    ])

    const resultado = pares.map((p) => ({
      id: p.id,
      activo: p.activo,
      producto: { id: p.producto_id, tipo: p.producto_tipo, nombre: nombres.get(p.producto_id)?.nombre ?? '(eliminado)' },
      complementario: { id: p.complementario_id, tipo: p.complementario_tipo, nombre: nombres.get(p.complementario_id)?.nombre ?? '(eliminado)' },
    }))

    return NextResponse.json(resultado)
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
    const producto_id = body.producto_id as string | undefined
    const producto_tipo = body.producto_tipo as TipoCatalogo | undefined
    const complementario_id = body.complementario_id as string | undefined
    const complementario_tipo = body.complementario_tipo as TipoCatalogo | undefined

    if (!producto_id || !complementario_id || !producto_tipo || !complementario_tipo) {
      return NextResponse.json({ error: 'producto y complementario son requeridos' }, { status: 400 })
    }
    if (producto_id === complementario_id) {
      return NextResponse.json({ error: 'Un producto no puede ser complementario de sí mismo' }, { status: 400 })
    }

    // Sin FK rígida (la tabla soporta dos catálogos) — validamos a mano que ambos IDs
    // existan en el catálogo correcto de esta ferretería antes de insertar.
    const nombres = await resolverNombres(supabase, session.ferreteriaId, [
      { id: producto_id, tipo: producto_tipo },
      { id: complementario_id, tipo: complementario_tipo },
    ])
    if (!nombres.has(producto_id)) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 })
    if (!nombres.has(complementario_id)) return NextResponse.json({ error: 'Complementario no encontrado' }, { status: 400 })

    const { data, error } = await supabase
      .from('productos_complementarios')
      .insert({
        ferreteria_id: session.ferreteriaId,
        producto_id,
        producto_tipo,
        complementario_id,
        complementario_tipo,
        tipo: 'manual',
        frecuencia: 1,
        activo: true,
      })
      .select('id, producto_id, producto_tipo, complementario_id, complementario_tipo, activo')
      .single()

    if (error) {
      console.error('Error creating complementario:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      activo: data.activo,
      producto: { id: data.producto_id, tipo: data.producto_tipo, nombre: nombres.get(data.producto_id)?.nombre },
      complementario: { id: data.complementario_id, tipo: data.complementario_tipo, nombre: nombres.get(data.complementario_id)?.nombre },
    })
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
