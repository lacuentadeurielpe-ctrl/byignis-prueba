import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/compras — Listar compras de la ferretería
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = await getDB()
  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado') || undefined
  const tipo = searchParams.get('tipo') || undefined
  const query = searchParams.get('q') || undefined

  try {
    const compras = await db.compras.listarCompras(session.ferreteriaId, { estado, tipo, query })
    return NextResponse.json(compras)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/compras — Crear una compra en borrador o recibida
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = await getDB()
  try {
    const body = await request.json()
    const { items, ...compraData } = body

    if (!compraData.tipo) {
      return NextResponse.json({ error: 'El tipo de compra (formal/informal/mixta) es requerido' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'La compra debe contener al menos un ítem' }, { status: 400 })
    }

    const compra = await db.compras.crearCompra(session.ferreteriaId, compraData, items)
    return NextResponse.json(compra, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
