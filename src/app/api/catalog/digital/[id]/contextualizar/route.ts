import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

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

  const contextualizacion = await generarContexto(producto as Record<string, unknown>)

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

async function generarContexto(p: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return buildFallback(p)

  const prompt = buildPrompt(p)
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
        max_tokens: 220,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return buildFallback(p)
    const json = await res.json()
    const text: string = json.choices?.[0]?.message?.content?.trim() ?? ''
    return text || buildFallback(p)
  } catch {
    return buildFallback(p)
  }
}

function buildPrompt(p: Record<string, unknown>): string {
  const tipos = tiposLabel(p.tipos_entrega)
  const descuento = p.precio_original && Number(p.precio_original) > Number(p.precio)
    ? ` (precio original S/ ${p.precio_original}, ${Math.round((1 - Number(p.precio) / Number(p.precio_original)) * 100)}% descuento)`
    : ''

  return `Eres un asistente de ventas para una tienda peruana. Crea un resumen de contexto conciso (máximo 3 oraciones) para el siguiente producto digital, usando ÚNICAMENTE los datos proporcionados sin inventar información. El texto será leído por un bot de WhatsApp para responder preguntas de clientes sobre este producto.

Datos del producto:
- Nombre: ${p.nombre}
- Categoría: ${p.categoria}${p.subcategoria ? ` / ${p.subcategoria}` : ''}
- Descripción: ${p.descripcion || 'No especificada'}
- Precio: S/ ${p.precio} por ${p.unidad}${descuento}
- Vigencia: ${p.vigencia || 'No especificada'}
- Stock disponible: ${p.stock != null ? p.stock : 'Ilimitado'}
- Formas de entrega: ${tipos}
- Etiquetas: ${Array.isArray(p.tags) && (p.tags as string[]).length ? (p.tags as string[]).join(', ') : 'Ninguna'}

Responde SOLO con el párrafo de contexto en español peruano, sin títulos ni viñetas.`
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
