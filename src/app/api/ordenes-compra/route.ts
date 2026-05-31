import { withAuth } from '@/lib/api/withAuth'
import { ApiSuccess, ApiError } from '@/lib/api/response'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ItemSchema = z.object({
  producto_id: z.string().uuid().optional().nullable(),
  nombre_producto: z.string().min(1, 'El nombre del producto es obligatorio'),
  marca: z.string().optional().nullable(),
  unidad: z.string().default('unidad'),
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  precio_unitario: z.number().min(0),
  subtotal: z.number().min(0)
})

const CreateOrderSchema = z.object({
  proveedor: z.string().min(1, 'El proveedor es obligatorio'),
  costo_total: z.number().min(0),
  notas: z.string().optional().nullable(),
  items: z.array(ItemSchema).min(1, 'La orden debe tener al menos un ítem')
})

export const GET = withAuth(async (req) => {
  const { data, error } = await req.supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*)')
    .eq('ferreteria_id', req.session.ferreteriaId)
    .order('created_at', { ascending: false })

  if (error) return ApiError(error.message)
  return ApiSuccess(data)
})

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const parsed = CreateOrderSchema.parse(body)
  const { proveedor, costo_total, notas, items } = parsed

  const { data: numeroData, error: numError } = await req.supabase
    .rpc('generar_numero_orden_compra')

  if (numError) return ApiError('Error generando correlativo', 500, numError)
  const numero_orden = numeroData || `OC-TEMP-${Date.now()}`

  const { data: orden, error: insertError } = await req.supabase
    .from('ordenes_compra')
    .insert({
      ferreteria_id: req.session.ferreteriaId,
      proveedor,
      numero_orden,
      costo_total,
      notas: notas || null,
      estado: 'borrador'
    })
    .select()
    .single()

  if (insertError || !orden) return ApiError(insertError?.message || 'Error al crear orden')

  const itemsToInsert = items.map(i => ({
    ...i,
    orden_compra_id: orden.id
  }))

  const { error: itemsError } = await req.supabase
    .from('items_orden_compra')
    .insert(itemsToInsert)

  if (itemsError) {
    await req.supabase.from('ordenes_compra').delete().eq('id', orden.id)
    return ApiError(itemsError.message)
  }

  return ApiSuccess(orden, 201)
})
