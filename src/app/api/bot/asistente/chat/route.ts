import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { buildAsistenteSystemPrompt, loadConfigSnapshot } from '@/lib/ai/asistente/context-builder'
import { ASISTENTE_TOOLS, executeToolCall } from '@/lib/ai/asistente/tools'
import { compactIfNeeded, type AsistenteMsg } from '@/lib/ai/asistente/compact'
import { checkConflict } from '@/lib/ai/asistente/conflict-checker'

export const dynamic = 'force-dynamic'

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
const ASSISTANT_MODEL    = 'claude-sonnet-4-6'
const MAX_TOOL_ROUNDS    = 5
const KEEP_ALIVE_MS      = 15_000
const HARD_LIMIT_MS      = 50_000

interface ContentBlock {
  type:        'text' | 'tool_use' | 'tool_result'
  text?:       string
  id?:         string
  name?:       string
  input?:      Record<string, unknown>
  tool_use_id?: string
  content?:    string
}

type ApiMessage = {
  role:    'user' | 'assistant'
  content: string | ContentBlock[]
}

export async function POST(req: NextRequest) {
  const session = await getSessionInfo()
  if (!session || session.rol !== 'dueno') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 })
  }

  const supabase = await createClient()

  let body: { messages: ApiMessage[] }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const encoder = new TextEncoder()
  let closed    = false

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        if (closed) return
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)) } catch {}
      }

      const keepAlive = setInterval(() => {
        if (closed) { clearInterval(keepAlive); return }
        try { controller.enqueue(encoder.encode(': keep-alive\n\n')) } catch {}
      }, KEEP_ALIVE_MS)

      const deadline = Date.now() + HARD_LIMIT_MS

      try {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          emit({ type: 'error', msg: 'ANTHROPIC_API_KEY no configurado. Contacta al administrador del sistema.' })
          return
        }

        // Cargar snapshot de config fresco desde DB
        const snapshot = await loadConfigSnapshot(supabase, session.ferreteriaId)

        // Compactar conversación si es larga
        const { messages: compacted, compacted: didCompact, summary } = await compactIfNeeded(body.messages as AsistenteMsg[])
        if (didCompact && summary) {
          emit({ type: 'compact', summary, messages: compacted })
        }

        const systemPrompt = buildAsistenteSystemPrompt(snapshot)
        let conversation: ApiMessage[] = compacted as ApiMessage[]
        let rounds = 0

        while (rounds < MAX_TOOL_ROUNDS) {
          if (Date.now() > deadline) {
            emit({ type: 'warning', msg: 'Tiempo de respuesta agotado. Continúa con otro mensaje.' })
            break
          }

          rounds++

          const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
            method:  'POST',
            headers: {
              'Content-Type':      'application/json',
              'x-api-key':         apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model:      ASSISTANT_MODEL,
              max_tokens: 2048,
              system:     systemPrompt,
              messages:   conversation,
              tools:      ASISTENTE_TOOLS,
            }),
          })

          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            console.error('[asistente/chat] Anthropic error', res.status, errText)
            emit({ type: 'error', msg: `Error del modelo: ${res.status}` })
            break
          }

          const data         = await res.json()
          const blocks:ContentBlock[] = data.content ?? []
          const stopReason   = String(data.stop_reason ?? 'end_turn')

          // Emitir texto al cliente
          const textParts = blocks.filter(b => b.type === 'text' && b.text).map(b => b.text!)
          if (textParts.length > 0) {
            emit({ type: 'text', text: textParts.join('') })
          }

          // Agregar respuesta del asistente a la conversación
          conversation = [...conversation, { role: 'assistant', content: blocks }]

          const toolBlocks = blocks.filter(b => b.type === 'tool_use')

          if (stopReason === 'end_turn' || toolBlocks.length === 0) break

          // Ejecutar tool calls
          const toolResults: ContentBlock[] = []

          for (const tb of toolBlocks) {
            const toolName = tb.name!
            const toolArgs = tb.input ?? {}
            const toolId   = tb.id!

            // Chequear conflictos
            const conflict = checkConflict(toolName, toolArgs, snapshot)
            if (conflict) {
              emit({ type: 'conflict', id: toolId, msg: conflict, tool: toolName, args: toolArgs })
              toolResults.push({ type: 'tool_result', tool_use_id: toolId, content: JSON.stringify({ conflict: true, msg: conflict }) })
              continue
            }

            emit({ type: 'tool_start', tool: toolName, args: toolArgs })

            try {
              const result = await executeToolCall(toolName, toolArgs, supabase, session.ferreteriaId, snapshot)

              if (result.patches) {
                for (const p of result.patches) emit({ type: 'patch', ...p })
              }

              emit({ type: 'tool_done', tool: toolName, ok: true })
              toolResults.push({ type: 'tool_result', tool_use_id: toolId, content: JSON.stringify(result.data) })
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Error desconocido'
              emit({ type: 'tool_done', tool: toolName, ok: false, msg: errMsg })
              toolResults.push({ type: 'tool_result', tool_use_id: toolId, content: JSON.stringify({ error: errMsg }) })
            }
          }

          // Agregar resultados como mensaje del usuario
          conversation = [...conversation, { role: 'user', content: toolResults }]
        }

        emit({ type: 'done', configSnapshot: snapshot })

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        emit({ type: 'error', msg })
      } finally {
        clearInterval(keepAlive)
        closed = true
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache, no-transform',
      'Connection':      'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
