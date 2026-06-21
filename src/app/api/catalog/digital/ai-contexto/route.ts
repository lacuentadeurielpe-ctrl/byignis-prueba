import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const PDF_MAX_CHARS = 12_000

export async function POST(req: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { pdf_url, nombre, categoria, subcategoria, precio, unidad, precio_original, vigencia, tags, tipos_entrega } = body

  if (!pdf_url) return NextResponse.json({ error: 'Se requiere pdf_url' }, { status: 400 })

  const pdfText = await extraerTextoPDF(pdf_url)
  if (!pdfText) return NextResponse.json({ error: 'No se pudo leer el PDF. Verifica que sea un PDF válido.' }, { status: 422 })

  const texto = await generarDescripcion({ nombre, categoria, subcategoria, precio, unidad, precio_original, vigencia, tags, tipos_entrega }, pdfText)
  return NextResponse.json({ texto })
}

async function extraerTextoPDF(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse')
    const data = await pdfParse(buffer)
    const text = data.text?.trim() ?? ''
    if (!text) return null
    return text.length > PDF_MAX_CHARS ? text.slice(0, PDF_MAX_CHARS) + '...' : text
  } catch {
    return null
  }
}

async function generarDescripcion(meta: Record<string, unknown>, pdfText: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return pdfText.slice(0, 500)

  const tipos = tiposLabel(meta.tipos_entrega)
  const descuento = meta.precio_original && Number(meta.precio_original) > Number(meta.precio)
    ? ` (antes S/ ${meta.precio_original}, ${Math.round((1 - Number(meta.precio) / Number(meta.precio_original)) * 100)}% descuento)`
    : ''

  const prompt = `Eres un experto en ventas digitales para el mercado peruano. Basándote en el contenido del PDF, genera una descripción de ventas COMPLETA para el producto. Esta descripción la usará el bot de WhatsApp para responder preguntas de clientes y cerrar ventas.

DATOS DEL PRODUCTO:
- Nombre: ${meta.nombre || 'No especificado'}
- Categoría: ${meta.categoria}${meta.subcategoria ? ` / ${meta.subcategoria}` : ''}
- Precio: S/ ${meta.precio} por ${meta.unidad}${descuento}
- Vigencia: ${meta.vigencia || 'No especificada'}
- Entrega: ${tipos}
- Tags: ${Array.isArray(meta.tags) && (meta.tags as string[]).length ? (meta.tags as string[]).join(', ') : 'Ninguno'}

CONTENIDO DEL PDF:
${pdfText}

---

Genera la descripción en español peruano con estas secciones (usa solo la información del PDF y los datos, no inventes):

**¿Qué es?** — 2 oraciones que expliquen el producto claramente.

**¿Para quién es?** — El perfil ideal del comprador.

**¿Qué aprenderás / incluye?** — 4-6 puntos concretos del contenido (extráelos del PDF).

**Beneficios clave:** — 3 resultados que obtendrá el comprador.

**¿Por qué comprarlo ahora?** — Justificación del valor y precio.

**Preguntas frecuentes:**
- ¿Cómo recibo el acceso? — [respuesta según tipo de entrega]
- ¿Tiene garantía? — [respuesta]
- ¿Necesito experiencia previa? — [respuesta basada en el PDF]

Usa emojis con moderación. Tono cercano y convincente, estilo peruano.`

  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) return pdfText.slice(0, 500)
    const json = await res.json()
    return json.choices?.[0]?.message?.content?.trim() ?? pdfText.slice(0, 500)
  } catch {
    return pdfText.slice(0, 500)
  }
}

function tiposLabel(tipos: unknown): string {
  if (!Array.isArray(tipos)) return 'entrega manual'
  const map: Record<string, string> = {
    descarga: 'descarga de archivo',
    link: 'enlace de acceso',
    clave: 'código de activación',
    manual: 'entrega manual por el vendedor',
  }
  return (tipos as string[]).map(t => map[t] ?? t).join(', ')
}
