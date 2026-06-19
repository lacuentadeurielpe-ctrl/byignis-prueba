// Gmail API helper — usa el access_token de Google OAuth para enviar emails.

interface GmailSendOptions {
  accessToken: string
  from:        string   // "Ferretería <correo@gmail.com>"
  to:          string
  subject:     string
  html:        string
  text?:       string
}

function buildRawEmail(opts: GmailSendOptions): string {
  const boundary = `----=_Part_${Date.now()}`
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    opts.html,
    '',
    `--${boundary}--`,
  ]
  return lines.join('\r\n')
}

export async function enviarEmailGmail(opts: GmailSendOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    const raw = Buffer.from(buildRawEmail(opts))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body:   JSON.stringify({ raw }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: (err as any)?.error?.message ?? `Gmail error ${res.status}` }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error desconocido al enviar email' }
  }
}
