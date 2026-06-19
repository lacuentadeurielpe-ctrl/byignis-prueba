import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { enviarMensajeTelegram } from '@/lib/integrations/telegram'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('ferreterias')
    .select('nombre, telegram_bot_token, telegram_chat_id')
    .eq('id', session.ferreteriaId)
    .single()

  if (!data?.telegram_bot_token || !data?.telegram_chat_id) {
    return NextResponse.json({ error: 'Telegram no configurado' }, { status: 400 })
  }

  const resultado = await enviarMensajeTelegram({
    botToken: data.telegram_bot_token,
    chatId:   data.telegram_chat_id,
    texto:    `✅ *FerroBot conectado*\n\nEsta es una prueba de notificación de *${data.nombre}*.\nLas notificaciones del bot aparecerán aquí.`,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error ?? 'Error enviando mensaje' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
