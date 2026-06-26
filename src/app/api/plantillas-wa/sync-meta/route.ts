import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { desencriptar } from '@/lib/encryption'

// GET /api/plantillas-wa/sync-meta
// Sincroniza los estados de las plantillas desde la API de Meta
export async function GET() {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
    return NextResponse.json({ error: 'WABA ID no configurado' }, { status: 400 })
  }

  const accessToken = await desencriptar(metaConfig.access_token_enc)

  const metaRes = await fetch(
    `https://graph.facebook.com/v18.0/${metaConfig.waba_id}/message_templates?fields=name,status,rejected_reason&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!metaRes.ok) {
    const err = await metaRes.json()
    return NextResponse.json({ error: err.error?.message ?? 'Error al consultar Meta' }, { status: metaRes.status })
  }

  const metaData = await metaRes.json()
  const templates: Array<{ name: string; status: string; rejected_reason?: string }> = metaData.data ?? []

  const supabase = await createClient()
  const { data: locales } = await supabase
    .from('plantillas_wa')
    .select('id, nombre, meta_status')
    .eq('ferreteria_id', session.ferreteriaId)

  const STATUS_MAP: Record<string, string> = {
    APPROVED: 'aprobada',
    REJECTED:  'rechazada',
    PENDING:   'pendiente',
    IN_APPEAL: 'pendiente',
    PAUSED:    'aprobada',
    DISABLED:  'rechazada',
  }

  let actualizadas = 0
  for (const tpl of templates) {
    const local = (locales ?? []).find(l => l.nombre === tpl.name)
    if (!local) continue

    const nuevoStatus = STATUS_MAP[tpl.status] ?? 'pendiente'
    if (local.meta_status === nuevoStatus) continue

    await supabase
      .from('plantillas_wa')
      .update({
        meta_status: nuevoStatus,
        meta_rechazo_motivo: tpl.rejected_reason ?? null,
      })
      .eq('id', local.id)

    actualizadas++
  }

  return NextResponse.json({ actualizadas, total: templates.length })
}
