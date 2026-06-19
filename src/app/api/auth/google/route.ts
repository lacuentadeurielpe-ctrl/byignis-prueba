// Inicia el flujo OAuth de Google. Redirige al consent screen.
// Solo puede llamarlo el dueño de la ferretería.
import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { buildGoogleAuthUrl } from '@/lib/integrations/google'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const url = buildGoogleAuthUrl(session.ferreteriaId)
  return NextResponse.redirect(url)
}
