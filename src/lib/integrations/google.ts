// Google OAuth 2.0 helper — un único login cubre Gmail, Calendar y Drive.
// Los tokens se guardan en integraciones_conectadas con tipo='google'.

export interface GoogleTokens {
  access_token:  string
  refresh_token: string
  expiry_date:   number   // epoch ms
  email:         string   // cuenta conectada
  calendar_id:   string   // 'primary' por defecto
  drive_folder_id?: string
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/** URL para iniciar el flujo OAuth. state = ferreteriaId cifrado para identificar al tenant. */
export function buildGoogleAuthUrl(ferreteriaId: string): string {
  const clientId    = process.env.GOOGLE_CLIENT_ID!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         GOOGLE_SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state:         ferreteriaId,
  })

  return `${GOOGLE_AUTH_URL}?${params}`
}

/** Intercambia el code de callback por access_token + refresh_token. */
export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      grant_type:    'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token exchange failed: ${err}`)
  }

  const data = await res.json()
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expiry_date:   Date.now() + (data.expires_in as number) * 1000,
  }
}

/** Obtiene el email de la cuenta usando el access_token recién obtenido. */
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal:  AbortSignal.timeout(5_000),
  })
  if (!res.ok) return 'desconocido'
  const data = await res.json()
  return data.email ?? 'desconocido'
}

/** Renueva el access_token usando el refresh_token. */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string
  expiry_date:  number
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token refresh failed: ${err}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    expiry_date:  Date.now() + (data.expires_in as number) * 1000,
  }
}

/**
 * Devuelve un access_token válido: lo refresca automáticamente si expiró o está a punto.
 * `tokens` viene del JSONB de integraciones_conectadas.
 * Devuelve { accessToken, updatedTokens? } — si hay tokens actualizados, persístelos en DB.
 */
export async function getValidAccessToken(tokens: GoogleTokens): Promise<{
  accessToken:    string
  updatedTokens?: Partial<GoogleTokens>
}> {
  const BUFFER_MS = 5 * 60 * 1000  // renovar si queda < 5 min
  const isExpired = Date.now() + BUFFER_MS >= tokens.expiry_date

  if (!isExpired) {
    return { accessToken: tokens.access_token }
  }

  const { access_token, expiry_date } = await refreshGoogleToken(tokens.refresh_token)
  return {
    accessToken:    access_token,
    updatedTokens:  { access_token, expiry_date },
  }
}
