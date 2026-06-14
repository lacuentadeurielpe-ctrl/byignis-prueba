// Cliente OpenAI para procesamiento de audio (Whisper) e imágenes (Vision)
// Solo activo si OPENAI_API_KEY está configurado

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'

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

// Mismo modelo que usa el módulo de catálogo (compras-ai.ts), que funciona en producción
const GEMINI_MODEL = 'gemini-2.5-flash'

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
 * Usa el SDK oficial @google/generative-ai con gemini-2.5-flash — el MISMO
 * patrón que el módulo de catálogo (compras-ai.ts) que funciona en producción.
 * Detecta si es una lista de productos, una foto de producto, comprobante de pago o algo genérico.
 * Retorna un análisis estructurado para que el bot pueda responder apropiadamente.
 */
export async function analizarImagen(
  buffer: Buffer,
  mimeType: string,
): Promise<AnalisisImagen | null> {
  const apiKey = getGeminiKey()
  if (!apiKey) {
    console.warn('[Gemini] Vision: GOOGLE_GENERATIVE_AI_API_KEY no configurada')
    return null
  }

  // Normalizar mimeType — Gemini solo acepta tipos de imagen válidos
  const mime = mimeType.includes('png') ? 'image/png'
    : mimeType.includes('webp') ? 'image/webp'
    : mimeType.includes('heic') || mimeType.includes('heif') ? 'image/heic'
    : 'image/jpeg'

  const base64 = buffer.toString('base64')

  const schema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      tipo: {
        type: SchemaType.STRING,
        description: 'Uno de: lista_productos, producto_individual, comprobante_pago, consulta, otro',
      },
      descripcion: {
        type: SchemaType.STRING,
        description: 'Respuesta amigable en español peruano para el cliente (máx 150 chars)',
      },
      productosDetectados: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            nombre: { type: SchemaType.STRING },
            cantidad: { type: SchemaType.NUMBER },
            precio: { type: SchemaType.NUMBER },
          },
          required: ['nombre'],
        },
      },
      pago: {
        type: SchemaType.OBJECT,
        properties: {
          monto: { type: SchemaType.NUMBER, description: 'Monto numérico del pago, ej 150.00' },
          destinatario: { type: SchemaType.STRING },
          operacion_id: { type: SchemaType.STRING },
          fecha: { type: SchemaType.STRING },
        },
      },
    },
    required: ['tipo', 'descripcion'],
  }

  const prompt = `Eres el asistente de una ferretería peruana. Analiza la imagen del cliente y clasifícala.

Determina el "tipo" según cuál de estos corresponde:
1. lista_productos: cotización escrita, lista de compras, captura de lista, pedido escrito → llena "productosDetectados"
2. producto_individual: foto de un producto para identificar, pedir precio o consultar
3. comprobante_pago: captura de pago Yape, Plin, transferencia bancaria, depósito, BCP, Interbank, BBVA, etc. → llena "pago"
4. consulta: foto de instalación, daño, medida, plano, obra
5. otro: selfie, paisaje, meme, nada relevante para la ferretería

La "descripcion" debe ser un mensaje amable en español peruano dirigido al cliente (máx 150 caracteres).
Si es lista_productos, extrae cada producto en "productosDetectados" con nombre y cantidad.
Si es comprobante_pago, extrae monto, destinatario, operacion_id y fecha en "pago".`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    })

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType: mime } },
    ])

    const textResponse = result.response.text()
    console.log(`[Gemini] Vision OK — ${buffer.length}b mime=${mime} → ${textResponse.slice(0, 120)}`)

    const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim()
    return JSON.parse(cleanJson) as AnalisisImagen
  } catch (e) {
    console.error('[Gemini] Error en analizarImagen:', e instanceof Error ? e.message : e)
    return null
  }
}

// ── Disponibilidad ────────────────────────────────────────────────────────────

export function openAIDisponible(): boolean {
  // Vision now uses Gemini; audio still uses OpenAI Whisper
  return !!(getKey() || getGeminiKey())
}
