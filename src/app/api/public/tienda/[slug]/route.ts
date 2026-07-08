import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const admin = createAdminClient()

    // Retrieve store info by slug
    const { data: store, error } = await admin
      .from('ferreterias')
      .select('id, nombre, telefono_whatsapp, logo_url, mensaje_bienvenida, catalogo_config')
      .eq('catalogo_slug', slug)
      .eq('activo', true)
      .single()

    if (error || !store) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      id: store.id,
      nombre: store.nombre,
      telefono_whatsapp: store.telefono_whatsapp,
      logo_url: store.logo_url,
      mensaje_bienvenida: store.mensaje_bienvenida,
      config: store.catalogo_config || {
        mostrar_precios: true,
        mostrar_sin_stock: false,
        mostrar_descripciones: true,
        mostrar_imagenes: true,
        mostrar_bulk_pricing: true
      }
    })
  } catch (err) {
    console.error('Error fetching public store info:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
