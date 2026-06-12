import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// OAuth de Mercado Pago no está implementado aún.
// Redirige de vuelta con un error claro.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const redirectUri = searchParams.get('redirect_uri') || '/dashboard/settings-2/integraciones/mercadopago'

  const url = new URL(redirectUri, request.url)
  url.searchParams.set('error', 'mercadopago_oauth_no_implementado')
  url.searchParams.set('msg', 'La integración OAuth de Mercado Pago está pendiente. Por ahora ingresa el access token manualmente.')

  return NextResponse.redirect(url.toString())
}
