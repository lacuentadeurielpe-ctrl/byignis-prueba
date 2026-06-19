// Callback de Google OAuth — intercambia el code, guarda tokens, redirige al dashboard.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeGoogleCode, getGoogleUserEmail } from '@/lib/integrations/google'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code         = searchParams.get('code')
  const ferreteriaId = searchParams.get('state')
  const error        = searchParams.get('error')

  const redirectBase = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings-2/integraciones/google`

  if (error || !code || !ferreteriaId) {
    return NextResponse.redirect(`${redirectBase}?error=acceso_denegado`)
  }

  try {
    const { access_token, refresh_token, expiry_date } = await exchangeGoogleCode(code)
    const email = await getGoogleUserEmail(access_token)

    const supabase = createAdminClient()
    const { error: dbErr } = await supabase
      .from('integraciones_conectadas')
      .upsert(
        {
          ferreteria_id: ferreteriaId,
          tipo:          'google',
          estado:        'conectado',
          conectado_at:  new Date().toISOString(),
          metadata: {
            access_token,
            refresh_token,
            expiry_date,
            email,
            calendar_id: 'primary',
          },
        },
        { onConflict: 'ferreteria_id,tipo' },
      )

    if (dbErr) {
      console.error('Error saving Google tokens:', dbErr)
      return NextResponse.redirect(`${redirectBase}?error=db`)
    }

    await supabase.from('integracion_logs').insert({
      ferreteria_id:    ferreteriaId,
      integracion_tipo: 'google',
      evento:           'conectado',
      detalle:          `Google conectado como ${email}`,
    })

    return NextResponse.redirect(`${redirectBase}?ok=1`)
  } catch (e: any) {
    console.error('Google OAuth callback error:', e)
    return NextResponse.redirect(`${redirectBase}?error=oauth`)
  }
}
