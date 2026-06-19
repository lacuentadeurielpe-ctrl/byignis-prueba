// Helper para enviar mensajes a Telegram via Bot API.
// Documentación: https://core.telegram.org/bots/api#sendmessage

export async function enviarMensajeTelegram({
  botToken,
  chatId,
  texto,
}: {
  botToken: string
  chatId: string
  texto: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json()
    if (!json.ok) return { ok: false, error: json.description ?? 'Error de Telegram' }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
