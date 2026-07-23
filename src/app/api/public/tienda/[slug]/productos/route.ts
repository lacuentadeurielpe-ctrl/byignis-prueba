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
    const tipo = searchParams.get('tipo') || 'fisico' // 'fisico' o 'digital'
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

    if (tipo === 'digital') {
      let query = admin
        .from('productos_digitales')
        .select('id, nombre, descripcion, precio, unidad, stock, thumbnail_url, categoria, destacado', { count: 'exact' })
        .eq('ferreteria_id', store.id)
        .eq('activo', true)

      if (search) query = query.ilike('nombre', `%${search}%`)
      if (category) query = query.eq('categoria', category)

      const { data: products, error, count } = await query
        .order('nombre', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) throw error

      const safeProducts = products?.map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        marca: null,
        stock: p.stock ?? 99999, // Digitales suelen no tener límite
        precio_base: config.mostrar_precios ? p.precio : null,
        unidad: p.unidad || 'Unidad',
        descripcion: config.mostrar_descripciones ? p.descripcion : null,
        imagenes: config.mostrar_imagenes && p.thumbnail_url ? [p.thumbnail_url] : [],
        descuentos: [],
        tipo: 'digital'
      }))

      return NextResponse.json({
        items: safeProducts,
        total: count || 0,
        page,
        totalPages: count ? Math.ceil(count / limit) : 0
      })
    }

    // FLUJO FÍSICO (default)
    let query = admin
      .from('productos')
      .select('id, nombre, descripcion, precio_base, unidad, stock, marca, imagenes, tiene_variantes, categorias(nombre), variantes:variantes_producto(*), atributos:producto_atributos(*, valores:atributo_valores(*))', { count: 'exact' })
      .eq('ferreteria_id', store.id)
      .eq('activo', true)

    if (!config.mostrar_sin_stock) {
      query = query.or('stock.gt.0,venta_sin_stock.eq.true')
    }

    if (search) query = query.ilike('nombre', `%${search}%`)
    if (category) query = query.eq('categoria_id', category)

    const { data: products, error, count } = await query
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw error

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

    const safeProducts = products?.map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categorias?.nombre,
      marca: p.marca,
      stock: p.tiene_variantes && p.variantes && p.variantes.length > 0
        ? p.variantes.reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
        : p.stock,
      precio_base: config.mostrar_precios ? p.precio_base : null,
      unidad: p.unidad,
      descripcion: config.mostrar_descripciones ? p.descripcion : null,
      imagenes: config.mostrar_imagenes ? p.imagenes : [],
      descuentos: config.mostrar_precios && config.mostrar_bulk_pricing ? rulesMap[p.id] || [] : [],
      tipo: 'fisico',
      tiene_variantes: p.tiene_variantes ?? false,
      variantes: p.variantes ?? [],
      atributos: p.atributos ?? []
    }))

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
