import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { accion } = body // 'confirmar' | 'anular'

    if (!accion || !['confirmar', 'anular'].includes(accion)) {
      return NextResponse.json({ error: 'Acción inválida. Use confirmar o anular' }, { status: 400 })
    }

    if (accion === 'confirmar') {
      // 1. Antes de confirmar, procesar los productos pendientes de creación (guardados en borrador)
      const { data: items } = await supabase
        .from('items_compra')
        .select('id, nombre_producto, codigo_interno, es_formal, unidad_compra, precio_compra_unitario')
        .eq('compra_id', id)
        .is('producto_id', null)

      if (items && items.length > 0) {
        for (const item of items) {
          try {
            if (item.codigo_interno && item.codigo_interno.includes('pendiente_crear')) {
              const meta = JSON.parse(item.codigo_interno)
              if (meta.pendiente_crear) {
                const nombreLimpio = item.nombre_producto.trim()

                // ── Verificación de Nombre Único ──
                // Si el dueño creó el producto manualmente mientras este borrador estaba pendiente,
                // evitamos duplicarlo y lo enlazamos al existente.
                const { data: prodExistente } = await supabase
                  .from('productos')
                  .select('id, codigo_interno')
                  .eq('ferreteria_id', session.ferreteriaId)
                  .ilike('nombre', nombreLimpio)
                  .limit(1)
                  .single()

                let finalProdId = null
                let finalCodigoInterno = null

                if (prodExistente) {
                  finalProdId = prodExistente.id
                  finalCodigoInterno = prodExistente.codigo_interno
                } else {
                  // Crear el producto ahora
                  const { data: prod, error: errProd } = await supabase
                    .from('productos')
                    .insert({
                      ferreteria_id: session.ferreteriaId,
                      nombre: item.nombre_producto.trim(),
                      categoria_id: meta.categoria_id,
                      precio_base: meta.precio_base,
                      precio_compra: item.precio_compra_unitario,
                      unidad: item.unidad_compra || 'NIU',
                      stock: 0,
                      stock_minimo: meta.stock_minimo,
                      facturable: item.es_formal,
                      activo: true,
                    })
                    .select('id, codigo_interno')
                    .single()

                  if (prod && !errProd) {
                    finalProdId = prod.id
                    finalCodigoInterno = prod.codigo_interno
                  }
                }

                if (finalProdId) {
                  // Actualizar items_compra para enlazar el nuevo producto (o el existente encontrado)
                  await supabase
                    .from('items_compra')
                    .update({ 
                      producto_id: finalProdId,
                      codigo_interno: finalCodigoInterno
                    })
                    .eq('id', item.id)

                  // Guardar el alias si estaba pendiente
                  if (meta.descripcion_factura) {
                    await db.compras.guardarAliasProducto(
                      session.ferreteriaId,
                      finalProdId,
                      meta.descripcion_factura,
                      1.0
                    )
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error al procesar producto pendiente:', e)
          }
        }
      }

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
    const { error } = await db.compras.supabase
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
