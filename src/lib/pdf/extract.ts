import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const PDF_MAX_CHARS = 12_000

export async function extractPdfText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null

    const arrayBuffer = await res.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // pdfjs-dist v5 legacy build — only this build works in Node.js (no DOMMatrix dep)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs')

    // Must point to the worker file — without this it throws "No workerSrc specified"
    const workerAbsPath = path.join(
      process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'legacy',
      'build',
      'pdf.worker.mjs',
    )
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerAbsPath).href

    const pdf = await pdfjsLib
      .getDocument({ data: uint8Array, useSystemFonts: true, isEvalSupported: false })
      .promise

    let text = ''
    const maxPages = Math.min((pdf.numPages as number), 60)
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = (content.items as any[])
        .map((item) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ')
      text += pageText + '\n'
    }

    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (!trimmed) return null
    return trimmed.length > PDF_MAX_CHARS ? trimmed.slice(0, PDF_MAX_CHARS) + '...' : trimmed
  } catch (err) {
    console.error('[pdf/extract]', err)
    return null
  }
}
