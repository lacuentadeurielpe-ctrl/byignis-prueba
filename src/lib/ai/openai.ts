// Cliente OpenAI para procesamiento de audio (Whisper) e imágenes (Vision)
// Solo activo si OPENAI_API_KEY está configurado

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'
import { reintentarIA } from '@/lib/ai/retry'

const OPENAI_BASE = 'https://api.openai.com/v1'

function getKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null
}

// ── Audio → Texto (Whisper) ──────────────────────────────────────────────────

export interface ResultadoAudio {
  texto:         string | null
  audioSegundos: number  // estimado del tamaño del buffer (Whisper no devuelve duración)
}

/**
 * Transcribe un audio usando OpenAI Whisper.
 * Retorna el texto y la duración estimada en segundos (para calcular costo).
 */
export async function transcribirAudio(
  buffer: Buffer,
  mimeType: string,
  idioma = 'es'
): Promise<ResultadoAudio> {
  const apiKey = getKey()
  // OGG/Opus de WhatsApp: ~16kbps ≈ 2000 bytes/seg
  const audioSegundos = Math.max(1, Math.round(buffer.length / 2000))
  if (!apiKey) return { texto: null, audioSegundos }

  const ext = mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
    : mimeType.includes('webm') ? 'webm'
    : mimeType.includes('wav') ? 'wav'
    : 'ogg'

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
      return { texto: null, audioSegundos }
    }

    const texto = await res.text()
    return { texto: texto.trim() || null, audioSegundos }
  } catch (e) {
    console.error('[OpenAI] Error en transcribirAudio:', e)
    return { texto: null, audioSegundos }
  }
}

// ── Imagen → Análisis (Gemini Vision) ───────────────────────────────────────

// Mismo modelo que usa el módulo de catálogo (compras-ai.ts), que funciona en producción
const GEMINI_MODEL = 'gemini-2.5-flash'

function getGeminiKey(): string | null {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null
}

/**
 * Fallback de visión con OpenAI GPT-4o cuando Gemini falla (503 "high demand", etc.).
 *
 * Reutiliza el MISMO prompt que se le pasó a Gemini (que ya pide el JSON con la
 * estructura exacta), así que el JSON resultante es compatible con el parseo del
 * caller. Devuelve `null` si no hay `OPENAI_API_KEY` o si no hay imágenes válidas.
 *
 * Nota: GPT-4o Vision NO acepta PDFs (solo imágenes); los PDFs se descartan.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function visionJSONOpenAI(opts: {
  imagenes: { base64: string; mimeType: string }[]
  prompt: string
  maxTokens?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<{ json: any; tokensEntrada: number; tokensSalida: number } | null> {
  const key = getKey()
  if (!key) return null

  // GPT-4o Vision solo acepta imágenes (no PDF)
  const imagenesValidas = opts.imagenes.filter((i) => !i.mimeType.toLowerCase().includes('pdf'))
  if (imagenesValidas.length === 0) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [
    { type: 'text', text: opts.prompt + '\n\nResponde ÚNICAMENTE con el JSON pedido, sin texto adicional ni markdown.' },
  ]
  for (const img of imagenesValidas) {
    const base64Data = img.base64.replace(/^data:[^;]+;base64,/, '')
    const mime = img.mimeType.includes('png') ? 'image/png'
      : img.mimeType.includes('webp') ? 'image/webp'
      : 'image/jpeg'
    content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${base64Data}` } })
  }

  const data = await reintentarIA(
    async () => {
      const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content }],
          response_format: { type: 'json_object' },
          max_tokens: opts.maxTokens ?? 4000,
          temperature: 0.1,
        }),
      })
      if (!r.ok) {
        const txt = await r.text()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err: any = new Error(`OpenAI vision ${r.status}: ${txt.slice(0, 200)}`)
        err.status = r.status
        throw err
      }
      return r.json()
    },
    { etiqueta: 'OpenAI/vision' },
  )

  const texto = data?.choices?.[0]?.message?.content ?? ''
  const cleanJson = String(texto).replace(/```json/gi, '').replace(/```/g, '').trim()
  const json = JSON.parse(cleanJson)
  return {
    json,
    tokensEntrada: data?.usage?.prompt_tokens ?? 0,
    tokensSalida: data?.usage?.completion_tokens ?? 0,
  }
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

export interface ResultadoImagen {
  analisis:      AnalisisImagen | null
  tokensEntrada: number
  tokensSalida:  number
}

/**
 * Analiza una imagen con Gemini Vision.
 * Retorna el análisis y los tokens consumidos (para calcular costo real).
 */
export async function analizarImagen(
  buffer: Buffer,
  mimeType: string,
): Promise<ResultadoImagen> {
  const apiKey = getGeminiKey()
  if (!apiKey) {
    console.warn('[Gemini] Vision: GOOGLE_GENERATIVE_AI_API_KEY no configurada')
    return { analisis: null, tokensEntrada: 0, tokensSalida: 0 }
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

    // Reintento con backoff: Gemini devuelve 503 "high demand" con frecuencia.
    const result = await reintentarIA(
      () => model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: mime } },
      ]),
      { etiqueta: 'Gemini/vision' },
    )

    const textResponse = result.response.text()
    const meta = result.response.usageMetadata
    const tokensEntrada = meta?.promptTokenCount     ?? 0
    const tokensSalida  = meta?.candidatesTokenCount ?? 0
    console.log(`[Gemini] Vision OK — ${buffer.length}b mime=${mime} in=${tokensEntrada} out=${tokensSalida}`)

    const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim()
    return { analisis: JSON.parse(cleanJson) as AnalisisImagen, tokensEntrada, tokensSalida }
  } catch (e) {
    console.error('[Gemini] Error en analizarImagen:', e instanceof Error ? e.message : e)
    // Fallback a OpenAI GPT-4o Vision cuando Gemini falla (503, etc.)
    try {
      const fb = await visionJSONOpenAI({
        imagenes: [{ base64, mimeType: mime }],
        prompt,
        maxTokens: 1000,
      })
      if (fb?.json) {
        console.log('[IA] Vision resuelta con fallback OpenAI GPT-4o')
        return { analisis: fb.json as AnalisisImagen, tokensEntrada: fb.tokensEntrada, tokensSalida: fb.tokensSalida }
      }
    } catch (fbErr) {
      console.error('[OpenAI] Fallback de visión también falló:', fbErr instanceof Error ? fbErr.message : fbErr)
    }
    return { analisis: null, tokensEntrada: 0, tokensSalida: 0 }
  }
}

// ── Disponibilidad ────────────────────────────────────────────────────────────

export function openAIDisponible(): boolean {
  // Vision now uses Gemini; audio still uses OpenAI Whisper
  return !!(getKey() || getGeminiKey())
}
