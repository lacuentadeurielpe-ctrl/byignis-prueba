import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { extractPdfText } from '@/lib/pdf/extract'

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: producto, error: fetchError } = await supabase
    .from('productos_digitales')
    .select('*')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (fetchError || !producto) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const p = producto as Record<string, unknown>
  let pdfText: string | null = null

  if (p.pdf_contexto_url) {
    pdfText = await extractPdfText(p.pdf_contexto_url as string)
  }

  const contextualizacion = await generarContexto(p, pdfText)

  const { data: updated, error: updateError } = await supabase
    .from('productos_digitales')
    .update({ contextualizacion, contextualizacion_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(updated)
}


async function generarContexto(p: Record<string, unknown>, pdfText: string | null): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return buildFallback(p)

  const prompt = pdfText ? buildPromptConPDF(p, pdfText) : buildPromptSinPDF(p)
  const maxTokens = pdfText ? 1200 : 300

  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) return buildFallback(p)
    const json = await res.json()
    const text: string = json.choices?.[0]?.message?.content?.trim() ?? ''
    return text || buildFallback(p)
  } catch {
    return buildFallback(p)
  }
}

function buildPromptConPDF(p: Record<string, unknown>, pdfText: string): string {
  const tipos = tiposLabel(p.tipos_entrega)
  const descuento = p.precio_original && Number(p.precio_original) > Number(p.precio)
    ? ` (antes S/ ${p.precio_original}, ${Math.round((1 - Number(p.precio) / Number(p.precio_original)) * 100)}% descuento)`
    : ''

  return `Eres un experto en ventas digitales para el mercado peruano. Basándote en el contenido del PDF y los datos del producto, genera un contexto de ventas COMPLETO que un bot de WhatsApp usará para responder preguntas de clientes potenciales.

DATOS DEL PRODUCTO:
- Nombre: ${p.nombre}
- Categoría: ${p.categoria}${p.subcategoria ? ` / ${p.subcategoria}` : ''}
- Descripción: ${p.descripcion || 'No especificada'}
- Precio: S/ ${p.precio} por ${p.unidad}${descuento}
- Vigencia: ${p.vigencia || 'No especificada'}
- Stock: ${p.stock != null ? p.stock : 'Ilimitado'}
- Entrega: ${tipos}
- Tags: ${Array.isArray(p.tags) && (p.tags as string[]).length ? (p.tags as string[]).join(', ') : 'Ninguno'}

CONTENIDO DEL PDF (extracto):
${pdfText}

---

Genera el contexto de ventas en español peruano con estas secciones (sin inventar información que no esté en el PDF o los datos):

**RESUMEN:** 2-3 oraciones que expliquen qué es el producto y para qué sirve.

**PÚBLICO OBJETIVO:** A quién va dirigido (perfil, nivel, necesidades).

**BENEFICIOS CLAVE:** 3-5 beneficios concretos que obtendrá el comprador.

**ÁNGULOS DE VENTA:** 2-3 formas de presentar el producto según distintas motivaciones del cliente (urgencia, valor, solución a problema).

**PRECIO Y VALOR:** Justificación del precio, comparación con alternativas si aplica.

**OBJECIONES FRECUENTES:** 3 objeciones comunes con sus respuestas.

**CIERRE:** Frase de cierre sugerida para el bot.

Usa un tono cercano, confiable y en español peruano. No uses información que no esté en los datos o el PDF.`
}

function buildPromptSinPDF(p: Record<string, unknown>): string {
  const tipos = tiposLabel(p.tipos_entrega)
  const descuento = p.precio_original && Number(p.precio_original) > Number(p.precio)
    ? ` (antes S/ ${p.precio_original}, ${Math.round((1 - Number(p.precio) / Number(p.precio_original)) * 100)}% descuento)`
    : ''

  return `Eres un asistente de ventas para una tienda peruana. Crea un resumen de contexto (máximo 4 oraciones) para el siguiente producto digital. El texto será leído por un bot de WhatsApp para responder preguntas de clientes. Usa ÚNICAMENTE los datos proporcionados.

- Nombre: ${p.nombre}
- Categoría: ${p.categoria}${p.subcategoria ? ` / ${p.subcategoria}` : ''}
- Descripción: ${p.descripcion || 'No especificada'}
- Precio: S/ ${p.precio} por ${p.unidad}${descuento}
- Vigencia: ${p.vigencia || 'No especificada'}
- Stock: ${p.stock != null ? p.stock : 'Ilimitado'}
- Entrega: ${tipos}
- Tags: ${Array.isArray(p.tags) && (p.tags as string[]).length ? (p.tags as string[]).join(', ') : 'Ninguno'}

Responde SOLO con el párrafo en español peruano, sin títulos ni viñetas.`
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

function buildFallback(p: Record<string, unknown>): string {
  const descuento = p.precio_original && Number(p.precio_original) > Number(p.precio)
    ? ` (antes S/ ${p.precio_original})`
    : ''
  return `${p.nombre} — ${p.categoria}. Precio: S/ ${p.precio}${descuento} por ${p.unidad}${p.vigencia ? `, vigencia: ${p.vigencia}` : ''}. Entrega: ${tiposLabel(p.tipos_entrega)}.`
}
