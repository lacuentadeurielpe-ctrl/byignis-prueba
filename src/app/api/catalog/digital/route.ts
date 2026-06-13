import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos_digitales')
    .select('*')
    .eq('ferreteria_id', session.ferreteriaId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const {
    nombre, categoria, subcategoria, descripcion,
    precio, precio_original, unidad, stock, vigencia, tags,
    destacado, activo,
    tipos_entrega, archivo_url, contenido_entrega, mensaje_entrega,
  } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (precio == null || Number(precio) < 0) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos_digitales')
    .insert({
      ferreteria_id: session.ferreteriaId,
      nombre: nombre.trim(),
      categoria: categoria?.trim() || 'General',
      subcategoria: subcategoria?.trim() || null,
      descripcion: descripcion?.trim() || null,
      precio: Number(precio),
      precio_original: precio_original ? Number(precio_original) : null,
      unidad: unidad?.trim() || 'unidad',
      stock: stock ? Number(stock) : null,
      vigencia: vigencia?.trim() || null,
      tags: Array.isArray(tags) ? tags : [],
      destacado: destacado ?? false,
      activo: activo ?? true,
      tipos_entrega: Array.isArray(tipos_entrega) && tipos_entrega.length > 0 ? tipos_entrega : ['manual'],
      archivo_url: archivo_url?.trim() || null,
      contenido_entrega: contenido_entrega?.trim() || null,
      mensaje_entrega: mensaje_entrega?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
