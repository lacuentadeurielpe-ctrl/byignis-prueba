import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/compras/[id] — Detalle de una compra con sus ítems
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const db = await getDB()

  try {
    const compra = await db.compras.obtenerCompraPorId(session.ferreteriaId, id)
    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }
    return NextResponse.json(compra)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/compras/[id] — Confirmar o anular recepción de compra
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const db = await getDB()
  
  try {
    const body = await request.json()
    const { accion } = body // 'confirmar' | 'anular'

    if (!accion || !['confirmar', 'anular'].includes(accion)) {
      return NextResponse.json({ error: 'Acción inválida. Use confirmar o anular' }, { status: 400 })
    }

    if (accion === 'confirmar') {
      await db.compras.confirmarRecepcion(session.ferreteriaId, id)
    } else {
      await db.compras.anularCompra(session.ferreteriaId, id)
    }

    const compraActualizada = await db.compras.obtenerCompraPorId(session.ferreteriaId, id)
    return NextResponse.json(compraActualizada)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/compras/[id] — Eliminar una compra en borrador
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const db = await getDB()
  
  try {
    const compra = await db.compras.obtenerCompraPorId(session.ferreteriaId, id)
    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    if (compra.estado !== 'borrador') {
      return NextResponse.json({ error: 'Solo se pueden eliminar compras en borrador' }, { status: 400 })
    }

    // Como es borrador, simplemente la borramos y la DB se encarga de items_compra por CASCADE
    const { error } = await db.supabase
      .from('compras')
      .delete()
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
