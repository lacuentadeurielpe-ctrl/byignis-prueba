import { withAuth } from '@/lib/api/withAuth'
import { ApiSuccess, ApiError } from '@/lib/api/response'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ItemSchema = z.object({
  producto_id: z.string().uuid().optional().nullable(),
  nombre_producto: z.string().min(1, 'El nombre del producto es obligatorio'),
  marca: z.string().optional().nullable(),
  unidad: z.string().default('unidad'),
  cantidad: z.number().positive(),
  precio_unitario: z.number().min(0),
  subtotal: z.number().min(0)
})

const UpdateOrderSchema = z.object({
  estado: z.string().optional(),
  notas: z.string().optional().nullable(),
  proveedor: z.string().optional(),
  costo_total: z.number().optional(),
  items: z.array(ItemSchema).optional()
})

export const GET = withAuth(async (req, { params }) => {
  const { id } = await params

  const { data, error } = await req.supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*)')
    .eq('id', id)
    .eq('ferreteria_id', req.session.ferreteriaId)
    .single()

  if (error) return ApiError(error.message)
  return ApiSuccess(data)
})

export const PATCH = withAuth(async (req, { params }) => {
  const { id } = await params
  const body = await req.json()
  const parsed = UpdateOrderSchema.parse(body)

  const { items, ...updateData } = parsed

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await req.supabase
      .from('ordenes_compra')
      .update(updateData)
      .eq('id', id)
      .eq('ferreteria_id', req.session.ferreteriaId)

    if (updateError) return ApiError(updateError.message)
  }

  if (items !== undefined) {
    const { error: deleteError } = await req.supabase
      .from('items_orden_compra')
      .delete()
      .eq('orden_compra_id', id)

    if (deleteError) return ApiError('Error al limpiar items anteriores: ' + deleteError.message)

    if (items.length > 0) {
      const itemsToInsert = items.map(i => ({
        ...i,
        orden_compra_id: id
      }))

      const { error: insertItemsError } = await req.supabase
        .from('items_orden_compra')
        .insert(itemsToInsert)

      if (insertItemsError) return ApiError('Error al insertar nuevos items: ' + insertItemsError.message)
    }
  }

  const { data: updatedOrden, error: fetchError } = await req.supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*)')
    .eq('id', id)
    .eq('ferreteria_id', req.session.ferreteriaId)
    .single()

  if (fetchError) return ApiError(fetchError.message)
  return ApiSuccess(updatedOrden)
})

export const DELETE = withAuth(async (req, { params }) => {
  const { id } = await params

  const { error } = await req.supabase
    .from('ordenes_compra')
    .delete()
    .eq('id', id)
    .eq('ferreteria_id', req.session.ferreteriaId)

  if (error) return ApiError(error.message)
  return ApiSuccess({ deleted: true })
})

