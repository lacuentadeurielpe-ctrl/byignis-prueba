import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const search = searchParams.get('q') || ''
    const category = searchParams.get('cat') || ''
    const limit = 24
    const offset = (page - 1) * limit

    const admin = createAdminClient()

    // Retrieve store config first
    const { data: store } = await admin
      .from('ferreterias')
      .select('id, catalogo_config')
      .eq('catalogo_slug', slug)
      .eq('activo', true)
      .single()

    if (!store) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    const config = store.catalogo_config || {
      mostrar_precios: true,
      mostrar_sin_stock: false,
      mostrar_descripciones: true,
      mostrar_imagenes: true,
      mostrar_bulk_pricing: true
    }

    let query = admin
      .from('productos')
      .select('id, nombre, descripcion, precio_base, unidad, stock, marca, imagenes, categorias(nombre)', { count: 'exact' })
      .eq('ferreteria_id', store.id)
      .eq('activo', true)

    // If hide out of stock is enabled, only show those with stock > 0 OR venta_sin_stock = true
    if (!config.mostrar_sin_stock) {
      query = query.or('stock.gt.0,venta_sin_stock.eq.true')
    }

    if (search) {
      query = query.ilike('nombre', `%${search}%`)
    }

    if (category) {
      query = query.eq('categoria_id', category)
    }

    const { data: products, error, count } = await query
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Fetch discount rules if needed
    let rulesMap: Record<string, any[]> = {}
    if (config.mostrar_bulk_pricing && products && products.length > 0) {
      const productIds = products.map((p: any) => p.id)
      const { data: rules } = await admin
        .from('reglas_descuento')
        .select('producto_id, cantidad_minima, precio_unitario')
        .in('producto_id', productIds)
        .order('cantidad_minima', { ascending: true })
      
      if (rules) {
        rules.forEach(r => {
          if (!rulesMap[r.producto_id]) rulesMap[r.producto_id] = []
          rulesMap[r.producto_id].push(r)
        })
      }
    }

    // Mask prices/descriptions/images if configured
    const safeProducts = products?.map((p: any) => {
      const out = {
        id: p.id,
        nombre: p.nombre,
        categoria: p.categorias?.nombre,
        marca: p.marca,
        stock: p.stock,
        precio_base: config.mostrar_precios ? p.precio_base : null,
        unidad: p.unidad,
        descripcion: config.mostrar_descripciones ? p.descripcion : null,
        imagenes: config.mostrar_imagenes ? p.imagenes : [],
        descuentos: config.mostrar_precios && config.mostrar_bulk_pricing ? rulesMap[p.id] || [] : []
      }
      return out
    })

    return NextResponse.json({
      items: safeProducts,
      total: count || 0,
      page,
      totalPages: count ? Math.ceil(count / limit) : 0
    })
  } catch (err) {
    console.error('Error fetching catalog products:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
