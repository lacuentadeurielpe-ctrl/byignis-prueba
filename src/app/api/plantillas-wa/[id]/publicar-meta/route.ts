import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { desencriptar } from '@/lib/encryption'

type Params = { params: Promise<{ id: string }> }

// POST /api/plantillas-wa/[id]/publicar-meta
// Envía la plantilla a Meta para aprobación vía WhatsApp Cloud API
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data: plantilla, error: errP } = await supabase
    .from('plantillas_wa')
    .select('*')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errP || !plantilla) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })

  const supabaseAdmin = createAdminClient()
  const { data: metaConfig } = await supabaseAdmin
    .from('configuracion_meta')
    .select('waba_id, access_token_enc, estado_conexion')
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!metaConfig || metaConfig.estado_conexion !== 'activo') {
    return NextResponse.json({ error: 'No hay cuenta Meta activa configurada' }, { status: 400 })
  }

  if (!metaConfig.waba_id) {
    return NextResponse.json({ error: 'WABA ID no configurado. Configúralo en Ajustes → Integraciones.' }, { status: 400 })
  }

  const accessToken = await desencriptar(metaConfig.access_token_enc)

  // Construir components de la plantilla según Meta API
  const components: object[] = []

  if (plantilla.header_tipo && plantilla.header_contenido) {
    components.push({
      type: 'HEADER',
      format: plantilla.header_tipo,
      ...(plantilla.header_tipo === 'TEXT' ? { text: plantilla.header_contenido } : { example: { header_url: [plantilla.header_contenido] } }),
    })
  }

  components.push({ type: 'BODY', text: plantilla.cuerpo })

  if (plantilla.footer) {
    components.push({ type: 'FOOTER', text: plantilla.footer })
  }

  if (Array.isArray(plantilla.botones) && plantilla.botones.length > 0) {
    const botonesFormatted = (plantilla.botones as Array<{ tipo: string; texto: string; valor?: string }>).map(b => {
      if (b.tipo === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.texto }
      if (b.tipo === 'URL') return { type: 'URL', text: b.texto, url: b.valor }
      if (b.tipo === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.texto, phone_number: b.valor }
      return { type: b.tipo, text: b.texto }
    })
    components.push({ type: 'BUTTONS', buttons: botonesFormatted })
  }

  const metaRes = await fetch(
    `https://graph.facebook.com/v18.0/${metaConfig.waba_id}/message_templates`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name:       plantilla.nombre,
        category:   plantilla.categoria,
        language:   plantilla.idioma ?? 'es',
        components,
      }),
    }
  )

  const metaData = await metaRes.json()

  if (!metaRes.ok) {
    return NextResponse.json({
      error: metaData.error?.message ?? 'Error al enviar a Meta',
      meta_error: metaData.error,
    }, { status: metaRes.status })
  }

  // Actualizar estado local a pendiente
  await supabase
    .from('plantillas_wa')
    .update({ meta_status: 'pendiente' })
    .eq('id', id)

  return NextResponse.json({ ok: true, meta_id: metaData.id, status: metaData.status })
}
