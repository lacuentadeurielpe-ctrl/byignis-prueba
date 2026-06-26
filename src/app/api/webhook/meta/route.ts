// Webhook de Meta WhatsApp Cloud API — paridad completa con YCloud
// GET  — verificación del webhook (hub challenge)
// POST — mensajes entrantes con:
//   · Audio → Whisper transcripción
//   · Imágenes → Vision + F5 detector de pagos
//   · Documentos (imagen) → Vision
//   · Interactive (button/list reply) → extrae texto
//   · Debounce para ráfagas de mensajes
//   · HMAC-SHA256 obligatorio con META_APP_SECRET

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { desencriptar } from '@/lib/encryption'
import { crearMetaSender } from '@/lib/whatsapp/drivers/meta-driver'
import { handleIncomingMessage } from '@/lib/bot/message-handler'
import { transcribirAudio, analizarImagen, openAIDisponible } from '@/lib/ai/openai'
import { registrarMovimiento, estimarCostoUsd } from '@/lib/credits'
import { acumularOProcesar } from '@/lib/bot/debounce'
import { extraerComprobante } from '@/lib/pagos/extractor'
import { getVerificacionPagosText } from '@/lib/ai/orchestrator-prompt'
import { procesarPago } from '@/lib/pagos/matcher'
import { normalizarTelefono } from '@/lib/utils'

// Vercel: hasta 60s para download + Whisper/Vision + DeepSeek en secuencia
export const maxDuration = 60

// ── GET: verificación inicial del webhook en Meta Developer Console ───────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe') {
    return new NextResponse('Method not allowed', { status: 400 })
  }

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

// ── Verificación HMAC-SHA256 ──────────────────────────────────────────────────
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

// ── Descarga de media vía Meta Graph API ─────────────────────────────────────
// Meta no entrega URLs directas — requiere:
//   1. GET /v18.0/{media_id} con Bearer token → obtiene URL temporal
//   2. GET esa URL con Bearer token → descarga el binario
async function descargarMediaMeta(
  mediaId: string,
  accessToken: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    // Paso 1 — obtener URL temporal del media
    const infoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!infoRes.ok) {
      console.warn(`[Meta Media] Error obteniendo info de media ${mediaId}: ${infoRes.status}`)
      return null
    }
    const info = await infoRes.json() as { url?: string; mime_type?: string }
    const mediaUrl  = info.url
    const mimeType  = info.mime_type ?? 'application/octet-stream'

    if (!mediaUrl) {
      console.warn(`[Meta Media] URL vacía para mediaId=${mediaId}`)
      return null
    }

    // Paso 2 — descargar binario
    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!mediaRes.ok) {
      console.warn(`[Meta Media] Error descargando binario: ${mediaRes.status}`)
      return null
    }

    const arrayBuffer = await mediaRes.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), mimeType }
  } catch (e) {
    console.error('[Meta Media] Error inesperado:', e)
    return null
  }
}

// ── POST: mensajes entrantes ──────────────────────────────────────────────────
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

  // ── 2. Extraer estructura del payload ────────────────────────────────────
  // Meta: payload.entry[0].changes[0].value
  const entry   = (payload.entry  as any[])?.[0]
  const change  = (entry?.changes as any[])?.[0]
  const value   = change?.value
  const meta    = value?.metadata
  const messages = value?.messages as any[] | undefined

  if (!messages?.length) {
    // Status updates (delivered/read), reactions, etc. — ignorar
    return NextResponse.json({ ok: true })
  }

  const phoneNumberId      = meta?.phone_number_id as string | undefined
  const displayPhoneNumber = (meta?.display_phone_number as string | undefined)?.replace(/^\+/, '')

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
    ferreteriaId:      ferreteria.id,
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
    const metaMessageId   = msg.id as string
    const telefonoCliente = (msg.from as string).replace(/^\+/, '')
    const tipo            = msg.type as string

    // Ignorar ecos del propio número (mensajes que el bot envió)
    if (telefonoCliente === telefonoFerreteria) {
      console.log(`[Meta Webhook] Eco propio ignorado (from=${telefonoCliente})`)
      continue
    }

    // Marcar como leído (ticks azules) — fire & forget
    sender.marcarLeido?.(metaMessageId).catch(() => {})

    if (tipo !== 'text') {
      const obj = (msg as any)[tipo] ?? {}
      console.log(`[Meta] tipo=${tipo} id=${obj.id ?? 'EMPTY'} mime=${obj.mime_type ?? '?'}`)
    } else {
      console.log(`[Meta] tipo=text from=${telefonoCliente}`)
    }

    let textoMensaje: string | null = null
    let notaParaBot:  string | null = null

    // ── TEXTO ────────────────────────────────────────────────────────────────
    if (tipo === 'text') {
      textoMensaje = (msg.text?.body as string)?.trim() ?? null

    // ── AUDIO → Whisper ──────────────────────────────────────────────────────
    } else if (tipo === 'audio') {
      const audioObj  = (msg.audio ?? {}) as Record<string, unknown>
      const audioId   = (audioObj.id as string) ?? null
      const audioMime = (audioObj.mime_type as string) ?? 'audio/ogg'

      console.log(`[Meta] Audio — id=${audioId ?? 'NULL'}, mime=${audioMime}, openAI=${openAIDisponible()}`)

      if (openAIDisponible() && audioId) {
        try {
          const media = await descargarMediaMeta(audioId, accessToken)
          if (media) {
            console.log(`[Meta] Audio descargado ${media.buffer.length}b mime=${media.mimeType} — enviando a Whisper`)
            const { texto: transcripcion, audioSegundos } = await transcribirAudio(media.buffer, media.mimeType)
            if (transcripcion) {
              console.log(`[Meta] Transcripción OK: "${transcripcion.slice(0, 80)}"`)
              textoMensaje = transcripcion
              notaParaBot  = '[El cliente envió un audio de voz — este es el texto transcrito]'
              const costoUsd = (audioSegundos / 60) * 0.006
              registrarMovimiento({
                ferreteriaId:  metaCfg.ferreteria_id,
                tipoTarea:     'audio_whisper',
                origen:        'bot',
                tokensEntrada: Math.ceil(audioSegundos),
                tokensSalida:  0,
                costoUsd,
              }).catch(() => {})
            } else {
              console.warn('[Meta] Whisper devolvió null — sin transcripción')
            }
          }
        } catch (e) {
          console.error('[Meta] Error procesando audio:', e)
        }
      } else if (!openAIDisponible()) {
        console.warn('[Meta] OpenAI no disponible — OPENAI_API_KEY no configurada')
      }

      if (!textoMensaje) {
        await sender.enviarMensaje({
          to:    telefonoCliente,
          texto: '🎧 Recibí tu nota de voz. Escríbeme tu consulta por texto y te ayudo enseguida 🙌',
        }).catch(() => {})
        continue
      }

    // ── IMAGEN → Vision + F5 ─────────────────────────────────────────────────
    } else if (tipo === 'image') {
      const imageObj  = (msg.image ?? {}) as Record<string, unknown>
      const imageId   = (imageObj.id as string) ?? null
      const imageMime = (imageObj.mime_type as string) ?? 'image/jpeg'
      const caption   = ((imageObj.caption as string) ?? '').trim()

      console.log(`[Meta] Imagen — id=${imageId ?? 'NULL'}, mime=${imageMime}, openAI=${openAIDisponible()}`)

      if (openAIDisponible() && imageId) {
        try {
          const media = await descargarMediaMeta(imageId, accessToken)
          if (media) {
            const mimeParaVision = (media.mimeType && media.mimeType !== 'application/octet-stream')
              ? media.mimeType : imageMime
            console.log(`[Meta] Vision: ${media.buffer.length}b mime=${mimeParaVision}`)

            const { analisis, tokensEntrada: vTkIn, tokensSalida: vTkOut } = await analizarImagen(media.buffer, mimeParaVision)
            if (vTkIn > 0 || vTkOut > 0) {
              estimarCostoUsd('gemini-2.5-flash', vTkIn, vTkOut)
                .then((costoUsd) => registrarMovimiento({
                  ferreteriaId:  metaCfg.ferreteria_id,
                  tipoTarea:     'imagen_vision',
                  origen:        'bot',
                  tokensEntrada: vTkIn,
                  tokensSalida:  vTkOut,
                  costoUsd,
                }))
                .catch(() => {})
            }

            if (analisis) {
              console.log(`[Meta] Imagen tipo: ${analisis.tipo}`)

              if (analisis.tipo === 'lista_productos' && analisis.productosDetectados?.length) {
                const listaTexto = analisis.productosDetectados
                  .map((p: any) => `${p.cantidad ? p.cantidad + 'x ' : ''}${p.nombre}`)
                  .join(', ')
                textoMensaje = `Quiero cotizar: ${listaTexto}`
                notaParaBot  = `[El cliente envió una imagen con una lista de productos. Vision detectó: ${listaTexto}]`

              } else if (analisis.tipo === 'comprobante_pago') {
                // ── F5: Detector especializado de pagos ───────────────────────
                console.log(`[Meta] Comprobante de pago detectado — ejecutando extractor F5`)

                const { data: botCfg } = await supabase
                  .from('configuracion_bot')
                  .select('prompt_overrides')
                  .eq('ferreteria_id', ferreteria.id)
                  .maybeSingle()
                const overrides    = ((botCfg?.prompt_overrides ?? {}) as Record<string, string>)
                const datosYape    = (ferreteria as Record<string, unknown>).datos_yape   as { numero?: string; nombre?: string } | null
                const datosPlin    = (ferreteria as Record<string, unknown>).datos_plin   as { numero?: string } | null
                const datosTransf  = (ferreteria as Record<string, unknown>).datos_transferencia as { banco?: string; cuenta?: string; titular?: string } | null
                let contextoTienda = getVerificacionPagosText(overrides)
                if (datosYape?.numero)  contextoTienda += `\n\nDatos de pago configurados:\n- Yape: ${datosYape.numero}${datosYape.nombre ? ` (${datosYape.nombre})` : ''}`
                if (datosPlin?.numero)  contextoTienda += `\n- Plin: ${datosPlin.numero}`
                if (datosTransf?.banco) contextoTienda += `\n- Transferencia (${datosTransf.banco}): cuenta …${datosTransf.cuenta?.slice(-4) ?? 'N/A'}, titular: ${datosTransf.titular ?? 'N/A'}`

                const datosComprobante = await extraerComprobante(media.buffer, mimeParaVision, contextoTienda)

                const telefonoClienteNorm = normalizarTelefono(telefonoCliente)
                const { data: clienteData } = await supabase
                  .from('clientes')
                  .select('id')
                  .eq('ferreteria_id', ferreteria.id)
                  .eq('telefono', telefonoClienteNorm)
                  .maybeSingle()

                if (datosComprobante) {
                  console.log(`[Meta F5] Comprobante extraído — tipo=${datosComprobante.tipo} monto=${datosComprobante.monto}`)
                  const resultado = await procesarPago({
                    supabase,
                    ferreteriaId: ferreteria.id,
                    clienteId:    clienteData?.id ?? null,
                    datos:        datosComprobante,
                  })
                  console.log(`[Meta F5] Pago procesado — estado=${resultado.estado}`)

                  if (resultado.estado === 'pendiente_revision' && resultado.mensajeDueno && ferreteria.telefono_dueno) {
                    const montoStr = datosComprobante.monto ? `S/${datosComprobante.monto.toFixed(2)}` : 'monto no legible'
                    sender.enviarMensaje({
                      to:    ferreteria.telefono_dueno,
                      texto: `${resultado.mensajeDueno}\nCliente: ${telefonoCliente}\nMonto: ${montoStr}\nOp: ${datosComprobante.numero_operacion ?? 'N/A'}\n\nRevisa en el panel 👇`,
                    }).catch(() => {})
                  }

                  await sender.enviarMensaje({ to: telefonoCliente, texto: resultado.mensajeCliente }).catch(() => {})

                  if (clienteData?.id) {
                    const { data: conv } = await supabase
                      .from('conversaciones')
                      .select('id')
                      .eq('ferreteria_id', ferreteria.id)
                      .eq('cliente_id', clienteData.id)
                      .order('ultima_actividad', { ascending: false })
                      .limit(1)
                      .maybeSingle()
                    if (conv?.id) {
                      supabase.from('mensajes').insert([
                        { conversacion_id: conv.id, role: 'cliente', contenido: '[Comprobante de pago enviado]' },
                        { conversacion_id: conv.id, role: 'bot',     contenido: resultado.mensajeCliente },
                      ]).then(() => {})
                    }
                  }
                  continue
                } else {
                  textoMensaje = caption || '[El cliente envió una imagen de pago]'
                  notaParaBot  = '[El cliente envió lo que parece un comprobante de pago, pero no se pudieron extraer los datos. Pídele que escriba el número de operación o el monto para registrarlo manualmente.]'
                }

              } else {
                textoMensaje = caption || analisis.descripcion
                notaParaBot  = `[El cliente envió una imagen. Análisis Vision: tipo=${analisis.tipo}, descripción="${analisis.descripcion}"]`
              }
            }
          }
        } catch (e) {
          console.error('[Meta] Error procesando imagen:', e)
        }
      }

      if (!textoMensaje) {
        if (caption) {
          textoMensaje = caption
        } else {
          textoMensaje = 'foto'
          notaParaBot  = '[El cliente envió una foto. Pídele amablemente que describa los productos que necesita o su consulta en texto.]'
        }
      }

    // ── DOCUMENTO → Vision si es imagen ─────────────────────────────────────
    } else if (tipo === 'document') {
      const docObj  = (msg.document ?? {}) as Record<string, unknown>
      const docId   = (docObj.id as string) ?? null
      const nombre  = (docObj.filename as string) ?? ''
      const caption = ((docObj.caption as string) ?? '').trim()
      const esImagen = /\.(jpg|jpeg|png|webp)$/i.test(nombre)

      if (openAIDisponible() && esImagen && docId) {
        try {
          const media = await descargarMediaMeta(docId, accessToken)
          if (media) {
            const { analisis, tokensEntrada: dTkIn, tokensSalida: dTkOut } = await analizarImagen(media.buffer, media.mimeType)
            if (dTkIn > 0 || dTkOut > 0) {
              estimarCostoUsd('gemini-2.5-flash', dTkIn, dTkOut)
                .then((costoUsd) => registrarMovimiento({
                  ferreteriaId:  metaCfg.ferreteria_id,
                  tipoTarea:     'imagen_vision',
                  origen:        'bot',
                  tokensEntrada: dTkIn,
                  tokensSalida:  dTkOut,
                  costoUsd,
                }))
                .catch(() => {})
            }
            if (analisis) {
              textoMensaje = analisis.tipo === 'lista_productos' && analisis.productosDetectados?.length
                ? `Quiero cotizar: ${analisis.productosDetectados.map((p: any) => `${p.cantidad ? p.cantidad + 'x ' : ''}${p.nombre}`).join(', ')}`
                : (caption || analisis.descripcion)
              notaParaBot = `[El cliente envió un documento imagen "${nombre}". Análisis: tipo=${analisis.tipo}]`
            }
          }
        } catch (e) {
          console.error('[Meta] Error procesando documento:', e)
        }
      }

      if (!textoMensaje) {
        if (caption) {
          textoMensaje = caption
        } else {
          await sender.enviarMensaje({
            to:    telefonoCliente,
            texto: `📄 Recibí tu ${nombre ? `archivo "${nombre}"` : 'documento'}. Para ayudarte mejor, cuéntame por texto qué necesitas 🙌`,
          }).catch(() => {})
          continue
        }
      }

    // ── INTERACTIVE (botones / lista) ────────────────────────────────────────
    } else if (tipo === 'interactive') {
      const itype = (msg.interactive?.type as string) ?? ''
      if (itype === 'button_reply') {
        textoMensaje = (msg.interactive?.button_reply?.title as string) ?? null
      } else if (itype === 'list_reply') {
        textoMensaje = (msg.interactive?.list_reply?.title as string) ?? null
      }
      if (!textoMensaje) continue

    // ── STICKER → ignorar silenciosamente ────────────────────────────────────
    } else if (tipo === 'sticker') {
      continue

    // ── OTROS (video, location, contacts, reaction) ──────────────────────────
    } else {
      const tipos: Partial<Record<string, string>> = {
        video:    '🎥 Recibí tu video, pero por ahora solo proceso texto e imágenes. Escríbeme qué necesitas 🙌',
        location: '📍 Vi tu ubicación. Si tienes consultas, escríbeme y te atiendo de inmediato 🙌',
        contacts: '👤 Recibí el contacto. Si necesitas algo, escríbeme y te ayudo 🙌',
      }
      const respuesta = tipos[tipo]
      if (respuesta) {
        await sender.enviarMensaje({ to: telefonoCliente, texto: respuesta }).catch(() => {})
      }
      continue
    }

    if (!textoMensaje) continue

    console.log(`[Meta] Mensaje de ${telefonoCliente}: "${textoMensaje.slice(0, 60)}"`)

    // ── Debounce (F4) — acumular ráfagas ─────────────────────────────────────
    let textoCompleto       = notaParaBot ? `${textoMensaje}\n\n${notaParaBot}` : textoMensaje
    let metaMessageIdFinal  = metaMessageId

    const debounceSegundos = Math.round(((ferreteria as any).bot_debounce_ms ?? 8000) / 1000)
    if (debounceSegundos > 0) {
      const resultado = await acumularOProcesar({
        supabase,
        ferreteriaId:    ferreteria.id,
        telefonoCliente,
        texto:           textoCompleto,
        ycloudMessageId: metaMessageId,
        debounceSegundos,
      })
      if (!resultado.procesar) continue
      textoCompleto      = resultado.textoAcumulado      ?? textoCompleto
      metaMessageIdFinal = resultado.ycloudMessageIdUltimo ?? metaMessageId
    }

    // ── Procesar con el bot ───────────────────────────────────────────────────
    try {
      const { respuesta, mensajesExtra } = await handleIncomingMessage({
        supabase,
        ferreteria,
        telefonoCliente,
        textoMensaje:    textoCompleto,
        ycloudMessageId: metaMessageIdFinal,
        sender,
      })

      if (!respuesta) {
        console.log(`[Meta] RESPUESTA_NULA — bot pausado o mensaje duplicado`)
        continue
      }

      const delayMs = ((ferreteria as any).bot_delay_respuesta_ms ?? 0) as number
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))

      await sender.enviarMensaje({ to: telefonoCliente, texto: respuesta })
      console.log(`[Meta] ENVIADO OK a ${telefonoCliente} (${respuesta.length} chars)`)

      // Marcar conexión como activa
      void supabase.from('configuracion_meta')
        .update({ estado_conexion: 'activo', ultimo_mensaje_at: new Date().toISOString() })
        .eq('ferreteria_id', ferreteria.id)

      if (mensajesExtra?.length) {
        for (const extra of mensajesExtra) {
          try {
            if (extra.tipo === 'texto') {
              await sender.enviarMensaje({ to: telefonoCliente, texto: extra.texto })
            } else if (extra.tipo === 'imagen') {
              await sender.enviarImagen({ to: telefonoCliente, imageUrl: extra.url, caption: extra.caption })
            } else if (extra.tipo === 'documento') {
              await sender.enviarDocumento({ to: telefonoCliente, pdfUrl: extra.url, filename: extra.filename, caption: extra.caption })
            }
          } catch (e) {
            console.error('[Meta] Error enviando mensaje extra:', e instanceof Error ? e.message : e)
          }
        }
      }

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
