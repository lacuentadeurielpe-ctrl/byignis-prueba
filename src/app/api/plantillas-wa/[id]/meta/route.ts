import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionInfo } from '@/lib/auth/roles'
import { desencriptar } from '@/lib/encryption'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/plantillas-wa/[id]/meta
// Elimina la plantilla de Meta y resetea el estado local a borrador
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { data: plantilla, error: errP } = await supabase
    .from('plantillas_wa')
    .select('nombre, ferreteria_id')
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

  if (!metaConfig || !metaConfig.waba_id) {
    return NextResponse.json({ error: 'No hay cuenta Meta configurada con WABA ID' }, { status: 400 })
  }

  const accessToken = await desencriptar(metaConfig.access_token_enc)

  const metaRes = await fetch(
    `https://graph.facebook.com/v18.0/${metaConfig.waba_id}/message_templates?name=${encodeURIComponent(plantilla.nombre)}`,
    {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!metaRes.ok) {
    const err = await metaRes.json()
    return NextResponse.json({
      error: err.error?.message ?? 'Error al eliminar de Meta',
      meta_error: err.error,
    }, { status: metaRes.status })
  }

  // Resetear estado local a borrador
  await supabase
    .from('plantillas_wa')
    .update({ meta_status: 'borrador', meta_rechazo_motivo: null })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
