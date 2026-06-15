import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { pausarBotConMotivo, reanudarBot, type MotivoPausa } from '@/lib/bot/session'

interface PatchBody {
  paused: boolean
  motivo?: MotivoPausa
  minutos?: number // solo aplica cuando paused=true; undefined = indefinido
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversacionId } = await params
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()

  // Verificar que la conversación pertenece a la ferretería del usuario
  const { data: conv } = await supabase
    .from('conversaciones')
    .select('id, ferreteria_id')
    .eq('id', conversacionId)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const body: PatchBody = await req.json()

  if (body.paused) {
    await pausarBotConMotivo(
      supabase,
      conversacionId,
      body.motivo ?? 'owner_dashboard',
      body.minutos
    )
  } else {
    await reanudarBot(supabase, conversacionId)
  }

  return NextResponse.json({ ok: true })
}
