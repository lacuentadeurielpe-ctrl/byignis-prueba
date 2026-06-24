const COMPACT_MODEL       = 'claude-haiku-4-5-20251001'
const MAX_TURNS_BEFORE_COMPACT = 15
const KEEP_LAST_TURNS     = 5

export interface AsistenteMsg {
  role:    'user' | 'assistant'
  content: string | unknown[]
}

export interface CompactResult {
  messages:  AsistenteMsg[]
  compacted: boolean
  summary?:  string
}

export async function compactIfNeeded(messages: AsistenteMsg[]): Promise<CompactResult> {
  // Only count string-content turns (not tool_result messages)
  const strTurns = messages.filter(m => typeof m.content === 'string')

  if (strTurns.length <= MAX_TURNS_BEFORE_COMPACT) {
    return { messages, compacted: false }
  }

  const toKeep     = strTurns.slice(-KEEP_LAST_TURNS)
  const toSummarize = strTurns.slice(0, -KEEP_LAST_TURNS)

  if (toSummarize.length === 0) return { messages, compacted: false }

  const summary = await summarize(toSummarize)
  if (!summary) return { messages, compacted: false }

  const newMessages: AsistenteMsg[] = [
    { role: 'user',      content: `[Resumen de la sesión anterior]\n${summary}` },
    { role: 'assistant', content: 'Entendido, tengo el contexto de lo que trabajamos.' },
    ...toKeep,
  ]

  return { messages: newMessages, compacted: true, summary }
}

async function summarize(messages: AsistenteMsg[]): Promise<string | null> {
  const transcript = messages
    .map(m => `${m.role === 'user' ? 'Dueño' : 'Asistente'}: ${String(m.content)}`)
    .join('\n')

  const prompt = `Resume esta conversación entre el dueño de una ferretería y su asistente de configuración del bot. En máximo 8 líneas con viñetas incluye: cambios realizados, decisiones tomadas, preferencias del dueño que surgieron, y contexto pendiente. Solo lo que realmente ocurrió.

${transcript}`

  // Intenta con Haiku primero (rápido y barato)
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      COMPACT_MODEL,
          max_tokens: 500,
          messages:   [{ role: 'user', content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text?.trim()
        if (text) return text
      }
    } catch {}
  }

  // Fallback a DeepSeek
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    try {
      const base = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
      const res  = await fetch(`${base}/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model:      'deepseek-chat',
          messages:   [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content?.trim()
        if (text) return text
      }
    } catch {}
  }

  return null
}
