// Cliente OpenAI para procesamiento de audio (Whisper) e imágenes (Vision)
// Solo activo si OPENAI_API_KEY está configurado

const OPENAI_BASE = 'https://api.openai.com/v1'

function getKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null
}

// ── Audio → Texto (Whisper) ──────────────────────────────────────────────────

/**
 * Transcribe un audio usando OpenAI Whisper.
 * Recibe el buffer del archivo de audio y su mime type.
 * Retorna el texto transcrito, o null si falla o no hay API key.
 */
export async function transcribirAudio(
  buffer: Buffer,
  mimeType: string,
  idioma = 'es'
): Promise<string | null> {
  const apiKey = getKey()
  if (!apiKey) return null

  // Determinar extensión por mime type
  const ext = mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
    : mimeType.includes('webm') ? 'webm'
    : mimeType.includes('wav') ? 'wav'
    : 'ogg'  // WhatsApp por defecto envía ogg/opus

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), `audio.${ext}`)
  form.append('model', 'whisper-1')
  form.append('language', idioma)
  form.append('response_format', 'text')

  try {
    const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[OpenAI] Error Whisper:', res.status, err)
      return null
    }

    const texto = await res.text()
    return texto.trim() || null
  } catch (e) {
    console.error('[OpenAI] Error en transcribirAudio:', e)
    return null
  }
}

// ── Imagen → Análisis (Gemini Vision) ───────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL = 'gemini-2.0-flash'

function getGeminiKey(): string | null {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null
}

export interface AnalisisImagen {
  tipo: 'lista_productos' | 'producto_individual' | 'comprobante_pago' | 'consulta' | 'otro'
  descripcion: string
  productosDetectados?: Array<{ nombre: string; cantidad?: number; precio?: number }>
  // Only present when tipo === 'comprobante_pago'
  pago?: {
    monto: number | null          // numeric amount extracted (e.g. 150.00)
    destinatario: string | null   // recipient name/number
    operacion_id: string | null   // operation/transaction ID
    fecha: string | null          // date string as shown in screenshot
  }
}

/**
 * Analiza una imagen con Gemini Vision.
 * Detecta si es una lista de productos, una foto de producto, comprobante de pago o algo genérico.
 * Retorna un análisis estructurado para que el bot pueda responder apropiadamente.
 */
export async function analizarImagen(
  buffer: Buffer,
  mimeType: string,
): Promise<AnalisisImagen | null> {
  const apiKey = getGeminiKey()
  if (!apiKey) return null

  const base64 = buffer.toString('base64')

  const systemPrompt = `Eres el asistente de una ferretería peruana. Analiza la imagen del cliente.

Determina cuál de estos tipos es:
1. LISTA_PRODUCTOS: cotización escrita, lista de compras, captura de lista, pedido escrito
2. PRODUCTO_INDIVIDUAL: foto de un producto para identificar, pedir precio o consultar
3. COMPROBANTE_PAGO: captura de pago Yape, Plin, transferencia bancaria, depósito, BCP, Interbank, BBVA, etc.
4. CONSULTA: foto de instalación, daño, medida, plano, obra
5. OTRO: selfie, paisaje, meme, nada relevante para la ferretería

Responde SOLO en JSON:
{
  "tipo": "lista_productos" | "producto_individual" | "comprobante_pago" | "consulta" | "otro",
  "descripcion": "respuesta amigable en español peruano para el cliente (máx 150 chars)",
  "productosDetectados": [{"nombre": "...", "cantidad": 2}],
  "pago": {
    "monto": 150.00,
    "destinatario": "...",
    "operacion_id": "...",
    "fecha": "..."
  }
}`

  try {
    const res = await fetch(
      `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: 'Analiza esta imagen del cliente.' },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 400,
          },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[Gemini] Error Vision:', res.status, err)
      return null
    }

    const data = await res.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      const finishReason = data.candidates?.[0]?.finishReason ?? 'N/A'
      const blockReason = data.promptFeedback?.blockReason ?? 'N/A'
      console.warn(`[Gemini] Vision sin content — finish=${finishReason} block=${blockReason} candidates=${data.candidates?.length ?? 0}`)
      return null
    }

    try {
      return JSON.parse(content) as AnalisisImagen
    } catch {
      console.warn(`[Gemini] Vision content no es JSON: ${content.slice(0, 200)}`)
      return null
    }
  } catch (e) {
    console.error('[Gemini] Error en analizarImagen:', e)
    return null
  }
}

// ── Disponibilidad ────────────────────────────────────────────────────────────

export function openAIDisponible(): boolean {
  // Vision now uses Gemini; audio still uses OpenAI Whisper
  return !!(getKey() || getGeminiKey())
}
