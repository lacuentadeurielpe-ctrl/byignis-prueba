import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/products/[id]/atributos — obtener atributos y valores del producto
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: productoId } = await params

  const { data, error } = await supabase
    .from('producto_atributos')
    .select('*, valores:atributo_valores(*)')
    .eq('producto_id', productoId)
    .eq('ferreteria_id', session.ferreteriaId)
    .order('orden', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/products/[id]/atributos — guardar o reemplazar lista completa de atributos y sus valores
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: productoId } = await params
  const body = await request.json()

  // body debe ser un array de { nombre: string, valores: { valor: string, color_hex?: string }[] }
  const atributosInput = Array.isArray(body) ? body : []

  // Borrar atributos existentes (los valores se borran en cascada FK)
  await supabase
    .from('producto_atributos')
    .delete()
    .eq('producto_id', productoId)
    .eq('ferreteria_id', session.ferreteriaId)

  const creados = []
  for (let i = 0; i < atributosInput.length; i++) {
    const attr = atributosInput[i]
    if (!attr.nombre?.trim()) continue

    const { data: nuevoAttr, error: errAttr } = await supabase
      .from('producto_atributos')
      .insert({
        ferreteria_id: session.ferreteriaId,
        producto_id: productoId,
        nombre: attr.nombre.trim(),
        orden: i
      })
      .select()
      .single()

    if (errAttr || !nuevoAttr) continue

    if (Array.isArray(attr.valores) && attr.valores.length > 0) {
      const valoresInsert = attr.valores.map((v: any, vIdx: number) => ({
        atributo_id: nuevoAttr.id,
        valor: String(v.valor ?? v).trim(),
        color_hex: v.color_hex || null,
        orden: vIdx
      }))
      const { data: nuevosValores } = await supabase
        .from('atributo_valores')
        .insert(valoresInsert)
        .select()

      creados.push({ ...nuevoAttr, valores: nuevosValores || [] })
    } else {
      creados.push({ ...nuevoAttr, valores: [] })
    }
  }

  return NextResponse.json(creados, { status: 201 })
}
