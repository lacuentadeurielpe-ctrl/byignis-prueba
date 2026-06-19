// Google Calendar API helper

export interface CalendarEvent {
  summary:     string
  description?: string
  location?:   string
  startIso:    string   // ISO 8601 con timezone, ej: "2025-06-20T10:00:00-05:00"
  endIso:      string
  attendees?:  string[] // emails
  calendarId?: string   // default 'primary'
}

export interface CalendarEventResult {
  ok:       boolean
  eventId?: string
  link?:    string
  error?:   string
}

export async function crearEventoCalendario(
  accessToken: string,
  evento: CalendarEvent,
): Promise<CalendarEventResult> {
  const calendarId = evento.calendarId ?? 'primary'
  const body: Record<string, unknown> = {
    summary:     evento.summary,
    description: evento.description,
    location:    evento.location,
    start: { dateTime: evento.startIso, timeZone: 'America/Lima' },
    end:   { dateTime: evento.endIso,   timeZone: 'America/Lima' },
  }

  if (evento.attendees?.length) {
    body.attendees = evento.attendees.map((email) => ({ email }))
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body:   JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: (err as any)?.error?.message ?? `Calendar error ${res.status}` }
    }

    const data = await res.json()
    return { ok: true, eventId: data.id, link: data.htmlLink }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al crear evento en Calendar' }
  }
}

export async function listarEventosHoy(
  accessToken: string,
  calendarId = 'primary',
): Promise<{ ok: boolean; eventos?: Array<{ titulo: string; inicio: string; fin: string }>; error?: string }> {
  const lima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
  const timeMin = new Date(`${lima}T00:00:00-05:00`).toISOString()
  const timeMax = new Date(`${lima}T23:59:59-05:00`).toISOString()

  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '20',
    })

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal:  AbortSignal.timeout(10_000),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: (err as any)?.error?.message ?? `Calendar error ${res.status}` }
    }

    const data = await res.json()
    const eventos = ((data.items ?? []) as any[]).map((e) => ({
      titulo: e.summary ?? '(sin título)',
      inicio: e.start?.dateTime ?? e.start?.date ?? '',
      fin:    e.end?.dateTime   ?? e.end?.date   ?? '',
    }))

    return { ok: true, eventos }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al listar eventos' }
  }
}
