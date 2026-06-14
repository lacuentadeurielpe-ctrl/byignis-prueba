import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { encriptar } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  // Fuente de verdad: configuracion_ycloud (es lo que usa el webhook)
  const { data: config } = await supabase
    .from('configuracion_ycloud')
    .select('estado_conexion, numero_whatsapp, configurado_at, ultimo_mensaje_at')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!config) return NextResponse.json({ estado: 'desconectado' })

  return NextResponse.json({
    estado: config.estado_conexion === 'activo' ? 'conectado' : (config.estado_conexion ?? 'desconectado'),
    numero_whatsapp: config.numero_whatsapp,
    configurado_at: config.configurado_at,
    ultimo_mensaje_at: config.ultimo_mensaje_at,
  })
}

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const { api_key, webhook_secret, telefono_whatsapp } = body as {
    api_key?: string
    webhook_secret?: string
    telefono_whatsapp?: string
  }

  if (!api_key?.trim()) {
    return NextResponse.json({ error: 'API Key es requerida' }, { status: 400 })
  }

  // Usar admin client para evitar bloqueos RLS en configuracion_ycloud
  const supabase = createAdminClient()

  // Encriptar credenciales (fallback a plain: si no hay ENCRYPTION_KEY)
  const apiKeyEnc = await encriptar(api_key.trim())
  const webhookSecretEnc = webhook_secret?.trim() ? await encriptar(webhook_secret.trim()) : null

  // 1. Guardar en configuracion_ycloud (tabla que usa el webhook)
  const { error: errConfig } = await supabase
    .from('configuracion_ycloud')
    .upsert(
      {
        ferreteria_id:      session.ferreteriaId,
        api_key_enc:        apiKeyEnc,
        webhook_secret_enc: webhookSecretEnc,
        numero_whatsapp:    telefono_whatsapp?.trim() || null,
        estado_conexion:    'activo',
        configurado_por:    null,
        configurado_at:     new Date().toISOString(),
      },
      { onConflict: 'ferreteria_id' }
    )

  if (errConfig) {
    console.error('Error saving configuracion_ycloud:', errConfig)
    return NextResponse.json({ error: errConfig.message }, { status: 500 })
  }

  // 2. Actualizar telefono_whatsapp en ferreterias si se proporcionó
  if (telefono_whatsapp?.trim()) {
    await supabase
      .from('ferreterias')
      .update({ telefono_whatsapp: telefono_whatsapp.trim().replace(/^\+/, '') })
      .eq('id', session.ferreteriaId)
  }

  // 3. Espejo en integraciones_conectadas (para UI de estado)
  await supabase
    .from('integraciones_conectadas')
    .upsert(
      {
        ferreteria_id: session.ferreteriaId,
        tipo:          'ycloud',
        estado:        'conectado',
        conectado_at:  new Date().toISOString(),
        metadata:      { telefono_whatsapp: telefono_whatsapp?.trim() || null },
      },
      { onConflict: 'ferreteria_id, tipo' }
    )

  // 4. Log
  await supabase.from('integracion_logs').insert({
    ferreteria_id:    session.ferreteriaId,
    integracion_tipo: 'ycloud',
    evento:           'conectado',
    detalle:          'YCloud API conectada',
    usuario_id:       session.userId,
  }).then(() => {})

  return NextResponse.json({ ok: true, estado: 'conectado' })
}

export async function DELETE() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()

  await Promise.all([
    supabase.from('configuracion_ycloud')
      .update({ estado_conexion: 'inactivo' })
      .eq('ferreteria_id', session.ferreteriaId),
    supabase.from('integraciones_conectadas')
      .upsert(
        { ferreteria_id: session.ferreteriaId, tipo: 'ycloud', estado: 'desconectado' },
        { onConflict: 'ferreteria_id, tipo' }
      ),
  ])

  await supabase.from('integracion_logs').insert({
    ferreteria_id:    session.ferreteriaId,
    integracion_tipo: 'ycloud',
    evento:           'desconectado',
    detalle:          'YCloud API desconectada',
    usuario_id:       session.userId,
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
