export const PDF_MAX_CHARS = 12_000

export async function extractPdfText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null

    const arrayBuffer = await res.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // unpdf is designed for serverless/edge — no native deps, no worker threads
    const { getDocumentProxy, extractText } = await import('unpdf')
    const pdf = await getDocumentProxy(uint8Array)
    const { text } = await extractText(pdf, { mergePages: true })

    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (!trimmed) return null
    return trimmed.length > PDF_MAX_CHARS ? trimmed.slice(0, PDF_MAX_CHARS) + '...' : trimmed
  } catch (err) {
    console.error('[pdf/extract]', err)
    return null
  }
}
