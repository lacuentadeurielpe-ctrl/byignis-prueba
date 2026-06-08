/**
 * POST /api/delivery/pedido/[pedidoId]/foto
 *
 * El repartidor sube una foto de evidencia de entrega.
 * Guarda en Supabase Storage (bucket: comprobantes) y agrega
 * la URL al array comprobante_fotos de la entrega correspondiente.
 *
 * Autenticación: por token de repartidor en query param ?token=xxx
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  const { pedidoId } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

  const supabase = adminClient()

  // Autenticar repartidor por token
  const { data: repartidor } = await supabase
    .from('repartidores')
    .select('id, nombre, ferreteria_id')
    .eq('token', token)
    .eq('activo', true)
    .single()

  if (!repartidor) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  // Verificar que el pedido pertenece a la ferretería del repartidor
  const { data: entrega } = await supabase
    .from('entregas')
    .select('id, comprobante_fotos, repartidor_id')
    .eq('pedido_id', pedidoId)
    .eq('ferreteria_id', repartidor.ferreteria_id)
    .maybeSingle()

  if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })

  // Leer la imagen del FormData
  const formData = await request.formData()
  const file = formData.get('foto') as File | null
  if (!file) return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 })

  // Validar tipo y tamaño
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Solo se aceptan imágenes' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) { // 5MB máx
    return NextResponse.json({ error: 'Imagen demasiado grande (máx 5MB)' }, { status: 400 })
  }

  // Nombre único para el archivo
  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `${repartidor.ferreteria_id}/${pedidoId}/${Date.now()}.${ext}`

  // Subir a Supabase Storage
  const arrayBuffer = await file.arrayBuffer()
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('comprobantes')
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[Foto] Error subiendo imagen:', uploadError)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from('comprobantes')
    .getPublicUrl(uploadData.path)

  const fotoUrl = urlData.publicUrl

  // Agregar URL al array comprobante_fotos de la entrega
  const fotosActuales = (entrega.comprobante_fotos as string[]) ?? []
  const nuevasFotos = [...fotosActuales, fotoUrl]

  await supabase
    .from('entregas')
    .update({ comprobante_fotos: nuevasFotos })
    .eq('id', entrega.id)

  return NextResponse.json({ ok: true, fotoUrl, totalFotos: nuevasFotos.length })
}
