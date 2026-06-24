'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { AsistenteConfigSnapshot } from '@/lib/ai/asistente/context-builder'

export interface ChatMessage {
  id:        string
  role:      'user' | 'assistant' | 'system'
  text:      string
  tools?:    ToolEvent[]
  conflict?: ConflictEvent
  isError?:  boolean
  isWarning?: boolean
}

export interface ToolEvent {
  tool:  string
  args:  Record<string, unknown>
  ok?:   boolean
  msg?:  string
  done:  boolean
}

export interface ConflictEvent {
  id:   string
  msg:  string
  tool: string
  args: Record<string, unknown>
}

export interface PatchEvent {
  target: string
  key?:   string
  value:  unknown
  at:     number
}

type ApiMessage = {
  role:    'user' | 'assistant'
  content: string | unknown[]
}

const SESSION_KEY = 'ferrobot_asistente_session'

function genId() {
  return Math.random().toString(36).slice(2)
}

export function useAsistente() {
  const [messages,       setMessages]       = useState<ChatMessage[]>([])
  const [apiMessages,    setApiMessages]    = useState<ApiMessage[]>([])
  const [configSnapshot, setConfigSnapshot] = useState<AsistenteConfigSnapshot | null>(null)
  const [recentPatches,  setRecentPatches]  = useState<PatchEvent[]>([])
  const [isLoading,      setIsLoading]      = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Restore session from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) {
        const { messages: msgs, apiMessages: api, configSnapshot: snap } = JSON.parse(raw)
        if (msgs)  setMessages(msgs)
        if (api)   setApiMessages(api)
        if (snap)  setConfigSnapshot(snap)
      }
    } catch {}
  }, [])

  // Persist session to sessionStorage on change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, apiMessages, configSnapshot }))
      }
    } catch {}
  }, [messages, apiMessages, configSnapshot])

  const addPatch = useCallback((patch: Omit<PatchEvent, 'at'>) => {
    const p = { ...patch, at: Date.now() }
    setRecentPatches(prev => [...prev.slice(-20), p])
    setConfigSnapshot(prev => {
      if (!prev) return prev
      const next = { ...prev }
      const target = patch.target as keyof AsistenteConfigSnapshot

      if (patch.key) {
        // patch for a sub-key in a Record
        const currentObj = (next[target] as Record<string, unknown>) ?? {}
        if (patch.value === null) {
          const updated = { ...currentObj }
          delete updated[patch.key]
          ;(next as Record<string, unknown>)[target] = updated
        } else {
          ;(next as Record<string, unknown>)[target] = { ...currentObj, [patch.key]: patch.value }
        }
      } else {
        ;(next as Record<string, unknown>)[target] = patch.value
      }
      return next
    })
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = { id: genId(), role: 'user', text: text.trim() }
    const assistantId = genId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', text: '', tools: [] }

    setMessages(prev => [...prev, userMsg, assistantMsg])

    const newApiMessages: ApiMessage[] = [
      ...apiMessages,
      { role: 'user', content: text.trim() },
    ]
    setApiMessages(newApiMessages)
    setIsLoading(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/bot/asistente/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: newApiMessages }),
        signal:  abortRef.current.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Error de red')
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, text: `Error: ${errText}`, isError: true } : m
        ))
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer    = ''
      let finalText = ''
      let finalApiMessages: ApiMessage[] | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue

          try {
            const event = JSON.parse(raw)
            switch (event.type) {
              case 'text':
                finalText += event.text as string
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, text: finalText } : m
                ))
                break

              case 'tool_start':
                setMessages(prev => prev.map(m => {
                  if (m.id !== assistantId) return m
                  const tools = [...(m.tools ?? []), { tool: event.tool as string, args: event.args as Record<string, unknown>, done: false }]
                  return { ...m, tools }
                }))
                break

              case 'tool_done':
                setMessages(prev => prev.map(m => {
                  if (m.id !== assistantId) return m
                  const tools = (m.tools ?? []).map(t =>
                    t.tool === event.tool && !t.done
                      ? { ...t, ok: event.ok as boolean, msg: event.msg as string | undefined, done: true }
                      : t
                  )
                  return { ...m, tools }
                }))
                break

              case 'patch':
                addPatch({ target: event.target as string, key: event.key as string | undefined, value: event.value })
                break

              case 'conflict':
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, conflict: { id: event.id as string, msg: event.msg as string, tool: event.tool as string, args: event.args as Record<string, unknown> } }
                    : m
                ))
                break

              case 'compact':
                if (event.messages) {
                  finalApiMessages = event.messages as ApiMessage[]
                }
                break

              case 'warning':
                setMessages(prev => [...prev, {
                  id:        genId(),
                  role:      'system',
                  text:      event.msg as string,
                  isWarning: true,
                }])
                break

              case 'error':
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, text: event.msg as string, isError: true } : m
                ))
                break

              case 'done':
                if (event.configSnapshot) {
                  setConfigSnapshot(event.configSnapshot as AsistenteConfigSnapshot)
                }
                break
            }
          } catch {}
        }
      }

      // Update API messages with assistant's full response
      const apiWithAssistant: ApiMessage[] = [
        ...(finalApiMessages ?? newApiMessages),
        { role: 'assistant', content: finalText || '(sin respuesta)' },
      ]
      setApiMessages(apiWithAssistant)

    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Error de red'
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, text: msg, isError: true } : m
      ))
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [apiMessages, isLoading, addPatch])

  const clearSession = useCallback(() => {
    setMessages([])
    setApiMessages([])
    setConfigSnapshot(null)
    setRecentPatches([])
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
  }, [])

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
  }, [])

  return {
    messages,
    configSnapshot,
    recentPatches,
    isLoading,
    sendMessage,
    clearSession,
    cancelRequest,
  }
}
