import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { enviarEmail } from '@/lib/integrations/resend'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ferreterias')
    .select('nombre, resend_api_key, resend_from_email')
    .eq('id', session.ferreteriaId)
    .single()

  if (error || !data?.resend_api_key || !data?.resend_from_email) {
    return NextResponse.json({ error: 'Resend no configurado' }, { status: 400 })
  }

  const result = await enviarEmail({
    apiKey:  data.resend_api_key,
    from:    `${data.nombre} <${data.resend_from_email}>`,
    to:      data.resend_from_email,
    subject: '✅ FerroBot — Conexión de email confirmada',
    html:    `<p>Hola,</p><p>Tu integración de email con <strong>${data.nombre}</strong> está funcionando correctamente.</p><p>—FerroBot</p>`,
    text:    `Integración de email con ${data.nombre} funcionando correctamente.`,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
