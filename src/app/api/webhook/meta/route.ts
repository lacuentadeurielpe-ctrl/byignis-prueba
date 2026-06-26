// Webhook de Meta WhatsApp Cloud API
// GET  — verificación del webhook (hub challenge)
// POST — mensajes entrantes (HMAC-SHA256 verificado con META_APP_SECRET)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { desencriptar } from '@/lib/encryption'
import { crearMetaSender } from '@/lib/whatsapp/drivers/meta-driver'
import { handleIncomingMessage } from '@/lib/bot/message-handler'

// ── GET: verificación inicial del webhook en Meta Developer Console ───────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe') {
    return new NextResponse('Method not allowed', { status: 400 })
  }

  // Buscar la ferretería que tenga este verify_token en su configuracion_meta
  const supabase = createAdminClient()
  const { data: cfg } = await supabase
    .from('configuracion_meta')
    .select('ferreteria_id')
    .eq('webhook_verify_token', token ?? '')
    .single()

  if (!cfg) {
    console.warn(`[Meta Webhook] verify_token no reconocido: ${token?.slice(0, 20)}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  console.log(`[Meta Webhook] Verificación OK para ferreteria=${cfg.ferreteria_id}`)
  return new NextResponse(challenge, { status: 200 })
}

// ── POST: mensajes entrantes ──────────────────────────────────────────────────

async function verificarFirmaMeta(body: string, signature: string | null): Promise<boolean> {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.warn('[Meta Webhook] META_APP_SECRET no configurado — saltando verificación')
    return true
  }
  if (!signature) return false

  const firmaLimpia = signature.replace(/^sha256=/, '')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expectedHex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return expectedHex === firmaLimpia
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text()

  // ── 1. Verificar firma HMAC ───────────────────────────────────────────────
  const firma = request.headers.get('x-hub-signature-256')
  const firmaValida = await verificarFirmaMeta(bodyText, firma)
  if (!firmaValida) {
    console.warn('[Meta Webhook] Firma HMAC inválida — rechazando')
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // ── 2. Extraer mensaje del payload ────────────────────────────────────────
  // Meta structure: payload.entry[0].changes[0].value.messages[0]
  const entry   = (payload.entry as any[])?.[0]
  const change  = (entry?.changes as any[])?.[0]
  const value   = change?.value
  const meta    = value?.metadata
  const messages = value?.messages as any[] | undefined

  if (!messages?.length) {
    // Status update, reaction, etc. — ignorar
    return NextResponse.json({ ok: true })
  }

  const phoneNumberId      = meta?.phone_number_id as string | undefined
  const displayPhoneNumber = meta?.display_phone_number as string | undefined

  if (!phoneNumberId) {
    console.warn('[Meta Webhook] No hay phone_number_id en el payload')
    return NextResponse.json({ ok: true })
  }

  // ── 3. Identificar tenant por phone_number_id ─────────────────────────────
  const supabase = createAdminClient()
  const { data: metaCfg } = await supabase
    .from('configuracion_meta')
    .select('ferreteria_id, access_token_enc, numero_whatsapp')
    .eq('phone_number_id', phoneNumberId)
    .eq('estado_conexion', 'activo')
    .single()

  if (!metaCfg) {
    console.warn(`[Meta Webhook] phone_number_id=${phoneNumberId} no reconocido o inactivo`)
    return NextResponse.json({ ok: true })
  }

  // ── 4. Desencriptar access token ──────────────────────────────────────────
  let accessToken: string
  try {
    accessToken = await desencriptar(metaCfg.access_token_enc)
  } catch (e) {
    console.error('[Meta Webhook] Error desencriptando access_token:', e)
    return NextResponse.json({ ok: true })
  }

  // ── 5. Cargar ferretería ──────────────────────────────────────────────────
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('*')
    .eq('id', metaCfg.ferreteria_id)
    .eq('activo', true)
    .single()

  if (!ferreteria) {
    console.warn(`[Meta Webhook] Ferretería inactiva id=${metaCfg.ferreteria_id}`)
    return NextResponse.json({ ok: true })
  }

  // ── 6. Crear sender Meta ──────────────────────────────────────────────────
  const telefonoFerreteria = (metaCfg.numero_whatsapp ?? displayPhoneNumber ?? '').replace(/^\+/, '')
  const sender = crearMetaSender({
    ferreteriaId:    ferreteria.id,
    telefonoFerreteria,
    phoneNumberId,
    accessToken,
  })

  // ── 7. Modo mantenimiento ─────────────────────────────────────────────────
  const { data: modoCfg } = await supabase
    .from('config_plataforma')
    .select('valor')
    .eq('clave', 'modo_mantenimiento')
    .single()

  if (modoCfg?.valor === true) {
    const { data: msgCfg } = await supabase
      .from('config_plataforma')
      .select('valor')
      .eq('clave', 'mensaje_mantenimiento')
      .single()
    const mensajeMant = typeof msgCfg?.valor === 'string'
      ? msgCfg.valor
      : 'Estamos realizando mantenimiento. El asistente estará disponible en breve.'

    for (const msg of messages) {
      await sender.enviarMensaje({ to: msg.from, texto: mensajeMant }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  // ── 8. Procesar cada mensaje ──────────────────────────────────────────────
  for (const msg of messages) {
    const metaMessageId  = msg.id as string
    const telefonoCliente = msg.from as string  // sin +
    const tipo            = msg.type as string

    // Marcar como leído (ticks azules)
    await sender.marcarLeido?.(metaMessageId)

    let textoMensaje: string | null = null

    if (tipo === 'text') {
      textoMensaje = msg.text?.body?.trim() ?? null

    } else if (tipo === 'audio') {
      // Para audio: la transcripción por Whisper requiere descargar el media por Meta Graph API
      // El media_id de Meta se descarga vía GET /v18.0/{media-id}?access_token=...
      // Por ahora, respuesta de fallback
      await sender.enviarMensaje({
        to:    telefonoCliente,
        texto: '🎧 Recibí tu nota de voz. Escríbeme tu consulta por texto y te ayudo enseguida 🙌',
      }).catch(() => {})
      continue

    } else if (tipo === 'image' || tipo === 'document' || tipo === 'sticker') {
      // Soporte futuro: descarga media vía Graph API
      await sender.enviarMensaje({
        to:    telefonoCliente,
        texto: 'Recibí tu archivo. Por ahora escríbeme lo que necesitas y te ayudo enseguida 🙌',
      }).catch(() => {})
      continue

    } else {
      // Reaction, location, contacts, etc. — ignorar
      continue
    }

    if (!textoMensaje) continue

    // ── Procesar con el bot ───────────────────────────────────────────────
    try {
      const { respuesta, mensajesExtra } = await handleIncomingMessage({
        supabase,
        ferreteria,
        telefonoCliente,
        textoMensaje,
        ycloudMessageId: metaMessageId,
        sender,
      })

      if (!respuesta) continue

      const delayMs = (ferreteria as any).bot_delay_respuesta_ms ?? 0
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))

      await sender.enviarMensaje({ to: telefonoCliente, texto: respuesta })

      if (mensajesExtra?.length) {
        for (const extra of mensajesExtra) {
          if (extra.tipo === 'texto') {
            await sender.enviarMensaje({ to: telefonoCliente, texto: extra.texto }).catch(() => {})
          } else if (extra.tipo === 'imagen') {
            await sender.enviarImagen({ to: telefonoCliente, imageUrl: extra.url, caption: extra.caption }).catch(() => {})
          } else if (extra.tipo === 'documento') {
            await sender.enviarDocumento({ to: telefonoCliente, pdfUrl: extra.url, filename: extra.filename, caption: extra.caption }).catch(() => {})
          }
        }
      }

      // Marcar conexión como activa
      void supabase.from('configuracion_meta')
        .update({ estado_conexion: 'activo', ultimo_mensaje_at: new Date().toISOString() })
        .eq('ferreteria_id', ferreteria.id)

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('[Meta Webhook] ERROR procesando mensaje:', errMsg)

      void supabase.from('configuracion_meta')
        .update({
          estado_conexion: 'error',
          ultimo_error:    errMsg.slice(0, 500),
          ultimo_error_at: new Date().toISOString(),
        })
        .eq('ferreteria_id', ferreteria.id)

      await sender.enviarMensaje({
        to:    telefonoCliente,
        texto: 'Disculpe, tuvimos un inconveniente. Por favor intente nuevamente en un momento. 🙏',
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
