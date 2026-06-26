import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { encriptar } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// GET — estado actual de la configuración Meta del tenant
export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('configuracion_meta')
    .select('estado_conexion, numero_whatsapp, phone_number_id, waba_id, webhook_verify_token, ultimo_mensaje_at, ultimo_error, ultimo_error_at')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!data) return NextResponse.json({ estado: 'desconectado' })

  return NextResponse.json({
    estado:               data.estado_conexion === 'activo' ? 'conectado' : (data.estado_conexion ?? 'desconectado'),
    numero_whatsapp:      data.numero_whatsapp,
    phone_number_id:      data.phone_number_id,
    waba_id:              data.waba_id,
    webhook_verify_token: data.webhook_verify_token,
    ultimo_mensaje_at:    data.ultimo_mensaje_at,
    ultimo_error:         data.ultimo_error,
    ultimo_error_at:      data.ultimo_error_at,
  })
}

// POST — guardar / actualizar credenciales Meta
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { phone_number_id, access_token, waba_id, numero_whatsapp } = body as {
    phone_number_id?: string
    access_token?: string
    waba_id?: string
    numero_whatsapp?: string
  }

  if (!phone_number_id?.trim()) {
    return NextResponse.json({ error: 'Phone Number ID es requerido' }, { status: 400 })
  }
  if (!access_token?.trim()) {
    return NextResponse.json({ error: 'Access Token es requerido' }, { status: 400 })
  }
  if (!numero_whatsapp?.trim()) {
    return NextResponse.json({ error: 'Número de WhatsApp es requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verificar que el phone_number_id no esté ya en uso por otro tenant
  const { data: existente } = await supabase
    .from('configuracion_meta')
    .select('ferreteria_id')
    .eq('phone_number_id', phone_number_id.trim())
    .neq('ferreteria_id', session.ferreteriaId)
    .single()

  if (existente) {
    return NextResponse.json({ error: 'Este Phone Number ID ya está registrado en otra cuenta' }, { status: 409 })
  }

  const accessTokenEnc = await encriptar(access_token.trim())
  const telefonoLimpio = numero_whatsapp.trim().replace(/^\+/, '')

  const { error: errUpsert } = await supabase
    .from('configuracion_meta')
    .upsert(
      {
        ferreteria_id:    session.ferreteriaId,
        phone_number_id:  phone_number_id.trim(),
        access_token_enc: accessTokenEnc,
        waba_id:          waba_id?.trim() || null,
        numero_whatsapp:  telefonoLimpio,
        estado_conexion:  'activo',
        ultimo_error:     null,
        ultimo_error_at:  null,
      },
      { onConflict: 'ferreteria_id' }
    )

  if (errUpsert) {
    console.error('[Meta settings] Error upsert:', errUpsert)
    return NextResponse.json({ error: errUpsert.message }, { status: 500 })
  }

  // Actualizar telefono_whatsapp en ferreterias si es nuevo número
  await supabase
    .from('ferreterias')
    .update({ telefono_whatsapp: telefonoLimpio })
    .eq('id', session.ferreteriaId)

  return NextResponse.json({ ok: true, estado: 'conectado' })
}

// DELETE — desconectar Meta (no borra la fila, pone estado=desconectado)
export async function DELETE() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createAdminClient()
  await supabase
    .from('configuracion_meta')
    .update({ estado_conexion: 'desconectado' })
    .eq('ferreteria_id', session.ferreteriaId)

  return NextResponse.json({ ok: true })
}
