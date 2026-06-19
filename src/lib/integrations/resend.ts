export interface EmailPayload {
  apiKey: string
  from: string      // "Nombre <email@dominio.com>"
  to: string
  subject: string
  html: string
  text?: string
}

export async function enviarEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${payload.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    payload.from,
        to:      [payload.to],
        subject: payload.subject,
        html:    payload.html,
        text:    payload.text,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>
      return { ok: false, error: (err.message as string | undefined) ?? `HTTP ${res.status}` }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
