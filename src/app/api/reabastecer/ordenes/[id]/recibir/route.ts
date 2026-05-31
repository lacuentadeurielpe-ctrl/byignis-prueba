import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// POST /api/reabastecer/ordenes/[id]/recibir — Confirmar entrega e ingresar stock a catálogo
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  // 1. Obtener la orden de compra y verificar pertenencia y estado
  const { data: orden, error: errFetchOrden } = await supabase
    .from('ordenes_compra')
    .select('*, items:items_orden_compra(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errFetchOrden || !orden) {
    return NextResponse.json({ error: 'Orden de compra no encontrada.' }, { status: 404 })
  }

  if (orden.estado !== 'pendiente') {
    return NextResponse.json({ error: 'La orden ya ha sido recibida o cancelada anteriormente.' }, { status: 400 })
  }

  const items = orden.items || []
  if (items.length === 0) {
    return NextResponse.json({ error: 'La orden no tiene ítems para procesar.' }, { status: 400 })
  }

  // 2. Marcar la orden como recibida atómicamente primero (para evitar condiciones de carrera)
  const { error: errUpdateEstado } = await supabase
    .from('ordenes_compra')
    .update({ estado: 'recibido', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)

  if (errUpdateEstado) {
    return NextResponse.json({ error: 'Error al actualizar el estado de la orden.' }, { status: 500 })
  }

  try {
    // 3. Procesar cada ítem de la orden
    for (const item of items) {
      let finalProductId = item.producto_id

      if (finalProductId) {
        // --- CASO A: Producto ya existe en catálogo ---
        // Obtener el stock actual del producto
        const { data: producto, error: errGetProd } = await supabase
          .from('productos')
          .select('stock, precio_compra')
          .eq('id', finalProductId)
          .eq('ferreteria_id', session.ferreteriaId)
          .single()

        if (producto) {
          const nuevoStock = (producto.stock || 0) + item.cantidad
          // Actualizar stock, costo de compra, proveedor y marca en el catálogo
          await supabase
            .from('productos')
            .update({
              stock: nuevoStock,
              precio_compra: item.precio_compra, // actualizar al costo más reciente
              proveedor: orden.proveedor_nombre,
              marca: item.marca || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', finalProductId)
            .eq('ferreteria_id', session.ferreteriaId)
        }
      } else {
        // --- CASO B: Producto manual (Fuera de catálogo) ---
        // Para evitar duplicación, buscar si ya existe un producto con el mismo nombre en esta ferretería
        const { data: prodExistente } = await supabase
          .from('productos')
          .select('id, stock')
          .eq('ferreteria_id', session.ferreteriaId)
          .ilike('nombre', item.nombre.trim())
          .limit(1)
          .single()

        if (prodExistente) {
          // Si ya existe por nombre, asociamos este ítem a ese producto e incrementamos el stock
          finalProductId = prodExistente.id
          const nuevoStock = (prodExistente.stock || 0) + item.cantidad
          await supabase
            .from('productos')
            .update({
              stock: nuevoStock,
              precio_compra: item.precio_compra,
              proveedor: orden.proveedor_nombre,
              marca: item.marca || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', finalProductId)
            .eq('ferreteria_id', session.ferreteriaId)
        } else {
          // Si no existe, crear un nuevo producto en catálogo
          // Calculamos precio de venta base añadiendo un 30% de margen sugerido por defecto
          const costo = item.precio_compra || 0
          const precioVentaSugerido = costo > 0 ? Number((costo * 1.30).toFixed(2)) : 0

          const { data: nuevoProd, error: errNewProd } = await supabase
            .from('productos')
            .insert({
              ferreteria_id: session.ferreteriaId,
              nombre: item.nombre.trim(),
              marca: item.marca || null,
              proveedor: orden.proveedor_nombre,
              precio_compra: costo,
              precio_base: precioVentaSugerido,
              stock: item.cantidad,
              unidad: item.unidad || 'unidad',
              activo: true,
              venta_sin_stock: false
            })
            .select('id')
            .single()

          if (nuevoProd) {
            finalProductId = nuevoProd.id
          } else {
            console.error('Error al crear producto automático:', errNewProd)
          }
        }

        // Vincular el producto_id creado o encontrado al ítem de la orden para registro histórico
        if (finalProductId) {
          await supabase
            .from('items_orden_compra')
            .update({ producto_id: finalProductId })
            .eq('id', item.id)
        }
      }
    }

    return NextResponse.json({ ok: true, estado: 'recibido' })
  } catch (err: any) {
    // Si algo falla al procesar el stock, revertimos el estado de la orden a 'pendiente' para poder reintentar
    await supabase
      .from('ordenes_compra')
      .update({ estado: 'pendiente', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('ferreteria_id', session.ferreteriaId)

    return NextResponse.json({ error: `Fallo al procesar inventario: ${err.message}` }, { status: 500 })
  }
}
