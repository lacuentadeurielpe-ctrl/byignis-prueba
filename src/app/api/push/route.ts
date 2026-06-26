import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'

// GET /api/push — retorna VAPID public key
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return NextResponse.json({ error: 'VAPID no configurado' }, { status: 503 })
  return NextResponse.json({ publicKey: key })
}

// POST /api/push — registrar suscripción
export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'subscription incompleta' }, { status: 400 })
  }

  const supabase = await createClient()
  const ua = req.headers.get('user-agent') ?? null

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id:       session.userId,
      ferreteria_id: session.ferreteriaId,
      endpoint,
      p256dh:        keys.p256dh,
      auth:          keys.auth,
      user_agent:    ua,
    }, { onConflict: 'user_id,endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/push — eliminar suscripción
export async function DELETE(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { endpoint } = await req.json()
  const supabase = await createClient()
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', session.userId)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
