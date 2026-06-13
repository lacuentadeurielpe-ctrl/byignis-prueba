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
    nombre, tipo, descripcion, precio, unidad,
    descripcion_bot, campos_requeridos, preguntas_frecuentes, destacado,
    metodo_entrega, contenido_entrega, mensaje_post_venta, vigencia,
    cupos_totales, fecha_inicio, fecha_fin, activo,
  } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (precio == null || precio < 0) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos_digitales')
    .insert({
      ferreteria_id: session.ferreteriaId,
      nombre: nombre.trim(),
      tipo: tipo || 'servicio',
      descripcion: descripcion?.trim() || null,
      precio: Number(precio),
      unidad: unidad?.trim() || 'unidad',
      descripcion_bot: descripcion_bot?.trim() || null,
      campos_requeridos: campos_requeridos || [],
      preguntas_frecuentes: preguntas_frecuentes || [],
      destacado: destacado ?? false,
      metodo_entrega: metodo_entrega || 'manual',
      contenido_entrega: contenido_entrega?.trim() || null,
      mensaje_post_venta: mensaje_post_venta?.trim() || null,
      vigencia: vigencia?.trim() || null,
      cupos_totales: cupos_totales ? Number(cupos_totales) : null,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      activo: activo ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
