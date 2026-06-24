'use client'

import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { Send, Square, Trash2, Zap, Bot, User, CheckCircle, XCircle, Loader2, AlertTriangle, Info } from 'lucide-react'
import type { ChatMessage, ToolEvent } from './useAsistente'

interface Props {
  messages:    ChatMessage[]
  isLoading:   boolean
  onSend:      (text: string) => void
  onCancel:    () => void
  onClear:     () => void
}

const QUICK_ACTIONS = [
  '¿Cómo está configurado el bot ahora?',
  'Hazlo más amigable y cálido',
  'Activa todos los agentes',
  'Lee los últimos logs del bot',
]

export default function ChatPanel({ messages, isLoading, onSend, onCancel, onClear }: Props) {
  const [input,    setInput]    = useState('')
  const bottomRef              = useRef<HTMLDivElement>(null)
  const textareaRef            = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    onSend(text)
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
            <Bot size={14} className="text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-zinc-800">Asistente IA</span>
          <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">claude-sonnet-4-6</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Trash2 size={12} />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Zap size={24} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700">Asistente de configuración</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                Dime qué quieres cambiar en el bot y lo haré directamente. Puedo apagar agentes, editar instrucciones, configurar recordatorios y más.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {QUICK_ACTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  disabled={isLoading}
                  className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-100 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2 items-start">
            <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={12} className="text-violet-600" />
            </div>
            <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-200 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe un mensaje… (Enter para enviar)"
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent disabled:opacity-50 bg-white"
          />
          {isLoading ? (
            <button
              onClick={onCancel}
              className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors shrink-0"
              title="Cancelar"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 flex items-center justify-center text-white transition-colors shrink-0 disabled:opacity-40"
              title="Enviar (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 mt-1 text-center">
          Shift+Enter para nueva línea · Solo puede editar configuración del bot
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'system') {
    return (
      <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${
        msg.isWarning ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-zinc-50 text-zinc-500'
      }`}>
        {msg.isWarning ? <AlertTriangle size={12} /> : <Info size={12} />}
        <span>{msg.text}</span>
      </div>
    )
  }

  if (msg.role === 'user') {
    return (
      <div className="flex gap-2 justify-end">
        <div className="max-w-[80%] bg-violet-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm">
          {msg.text}
        </div>
        <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
          <User size={12} className="text-zinc-500" />
        </div>
      </div>
    )
  }

  // Assistant
  return (
    <div className="flex gap-2 items-start">
      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={12} className="text-violet-600" />
      </div>
      <div className="max-w-[85%] space-y-2">
        {/* Tool events */}
        {(msg.tools ?? []).length > 0 && (
          <div className="space-y-1">
            {(msg.tools ?? []).map((t, i) => (
              <ToolBadge key={i} tool={t} />
            ))}
          </div>
        )}

        {/* Conflict warning */}
        {msg.conflict && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <div className="flex items-center gap-1.5 font-medium mb-1">
              <AlertTriangle size={12} />
              <span>Conflicto detectado</span>
            </div>
            <p>{msg.conflict.msg}</p>
            <p className="text-amber-600 mt-1">
              Responde "confirmo" para proceder de todas formas.
            </p>
          </div>
        )}

        {/* Text */}
        {msg.text && (
          <div className={`rounded-2xl rounded-tl-sm px-3 py-2 text-sm whitespace-pre-wrap ${
            msg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-zinc-100 text-zinc-800'
          }`}>
            {msg.isError && <span className="font-medium">Error: </span>}
            {msg.text}
          </div>
        )}

        {/* Still loading (empty text + tools in progress) */}
        {!msg.text && (msg.tools ?? []).length > 0 && (msg.tools ?? []).some(t => !t.done) && (
          <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-3 py-2">
            <TypingDots />
          </div>
        )}
      </div>
    </div>
  )
}

function ToolBadge({ tool }: { tool: ToolEvent }) {
  const icon = tool.done
    ? tool.ok
      ? <CheckCircle size={10} className="text-green-600" />
      : <XCircle size={10} className="text-red-500" />
    : <Loader2 size={10} className="text-violet-500 animate-spin" />

  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] rounded-full px-2 py-0.5 border ${
      !tool.done
        ? 'bg-violet-50 border-violet-200 text-violet-700'
        : tool.ok
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-red-50 border-red-200 text-red-700'
    }`}>
      {icon}
      <span className="font-mono">{tool.tool}</span>
      {tool.msg && <span>— {tool.msg}</span>}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}
