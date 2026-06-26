'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatFecha, formatHora } from '@/lib/utils'
import {
  Send, RefreshCw, ArrowLeft, Bot, Mic, Image as ImageIcon,
  FileText, X, CornerDownLeft, Lock, ChevronRight, Tag, User,
  Paperclip, StickyNote,
} from 'lucide-react'
import VentanaEntregaBadge from '@/components/delivery/VentanaEntregaBadge'

interface Etiqueta {
  id: string
  nombre: string
  color: string
}

interface RespuestaRapida {
  id: string
  atajo: string
  contenido: string
  categoria: string | null
}

interface Mensaje {
  id: string
  role: string
  contenido: string
  tipo?: string | null
  created_at: string
  media_url?: string | null
  media_tipo?: 'imagen' | 'video' | 'audio' | 'documento' | 'sticker' | null
  es_nota_interna?: boolean
  responde_a?: string | null
  reaccion?: string | null
}

interface Conversacion {
  id: string
  estado: string
  bot_pausado: boolean
  estado_atencion?: string
  clientes: {
    id?: string
    nombre: string | null
    telefono: string
  } | null
  [key: string]: unknown
}

interface ChatViewProps {
  conversacion: Conversacion
  mensajesIniciales: Mensaje[]
  ferreteriaId: string
  etiquetasConv?: Etiqueta[]
  etiquetasDisponibles?: Etiqueta[]
}

// ── Estilos de burbuja ─────────────────────────────────────────────────────
function getBubbleStyle(role: string, esNotaInterna: boolean) {
  if (esNotaInterna) return {
    wrap:   'mr-4 ml-4 items-start',
    bubble: 'bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl shadow-sm',
    time:   'text-amber-600/70',
  }
  if (role === 'cliente') return {
    wrap:   'mr-12 items-start',
    bubble: 'bg-white border border-zinc-200 text-zinc-900 rounded-2xl rounded-tl-none shadow-sm',
    time:   'text-zinc-400',
  }
  if (role === 'dueno') return {
    wrap:   'ml-12 items-end',
    bubble: 'bg-zinc-900 text-white rounded-2xl rounded-tr-none',
    time:   'text-zinc-500',
  }
  return {
    wrap:   'mr-12 items-start',
    bubble: 'bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-2xl rounded-tl-none',
    time:   'text-zinc-400',
  }
}

function getRoleLabel(role: string, primerNombre: string): string {
  if (role === 'cliente') return primerNombre
  if (role === 'bot')     return 'Bot'
  if (role === 'dueno')   return 'Tú'
  return role
}

function BubbleTail({ role }: { role: string }) {
  if (role === 'dueno') {
    return <div className="absolute -right-[7px] top-0 w-0 h-0 border-l-[8px] border-l-zinc-900 border-b-[8px] border-b-transparent" />
  }
  const color = role === 'bot' ? 'border-r-zinc-200' : 'border-r-white'
  return (
    <div className={cn(
      'absolute -left-[7px] top-0 w-0 h-0',
      'border-r-[8px]', color,
      'border-b-[8px] border-b-transparent'
    )} />
  )
}

// ── Media Render ────────────────────────────────────────────────────────────
function MediaBubble({ url, tipo, isDueno }: { url: string; tipo: string; isDueno: boolean }) {
  if (tipo === 'imagen') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt="Imagen"
          className="rounded-xl max-w-[240px] max-h-[240px] object-cover cursor-pointer hover:opacity-90 transition"
          loading="lazy"
        />
      </a>
    )
  }
  if (tipo === 'audio') {
    return <audio controls src={url} className="max-w-[240px] h-10" />
  }
  if (tipo === 'video') {
    return (
      <video controls src={url} className="rounded-xl max-w-[240px] max-h-[240px]">
        <source src={url} />
      </video>
    )
  }
  if (tipo === 'documento') {
    const nombre = url.split('/').pop()?.split('?')[0] ?? 'documento'
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium hover:opacity-80 transition',
          isDueno
            ? 'bg-white/10 text-white border border-white/20'
            : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
        )}
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[160px]">{nombre}</span>
        <ChevronRight className="w-3 h-3 shrink-0" />
      </a>
    )
  }
  return null
}

export default function ChatView({
  conversacion,
  mensajesIniciales,
  ferreteriaId,
  etiquetasConv = [],
  etiquetasDisponibles = [],
}: ChatViewProps) {
  const router = useRouter()

  const [mensajes,        setMensajes]        = useState<Mensaje[]>(mensajesIniciales)
  const [botPausado,      setBotPausado]       = useState(conversacion.bot_pausado)
  const [texto,           setTexto]           = useState('')
  const [enviando,        setEnviando]         = useState(false)
  const [resumiendo,      setResumiendo]       = useState(false)
  const [pausando,        setPausando]         = useState(false)
  const [error,           setError]            = useState<string | null>(null)
  const [modoNota,        setModoNota]         = useState(false)
  const [citando,         setCitando]          = useState<Mensaje | null>(null)
  const [etasPedido, setEtasPedido] = useState<{ numero: string; etaTimestamp: string | null } | null>(null)

  // Respuestas rápidas
  const [respuestas,    setRespuestas]    = useState<RespuestaRapida[]>([])
  const [showRespuestas, setShowRespuestas] = useState(false)
  const [filtroRespuesta, setFiltroRespuesta] = useState('')

  // Etiquetas
  const [etiquetasLocales, setEtiquetasLocales] = useState<Etiqueta[]>(etiquetasConv)
  const [showEtiquetas,    setShowEtiquetas]    = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  // Cargar respuestas rápidas
  useEffect(() => {
    fetch('/api/respuestas-rapidas')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRespuestas(data) })
      .catch(() => {})
  }, [])

  // ETA pedido delivery
  useEffect(() => {
    const tel = conversacion.clientes?.telefono
    if (!tel) return
    const supabase = createClient()
    supabase
      .from('pedidos')
      .select('numero_pedido, eta_timestamp')
      .eq('ferreteria_id', ferreteriaId)
      .eq('telefono_cliente', tel)
      .eq('modalidad', 'delivery')
      .not('eta_timestamp', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEtasPedido({ numero: data.numero_pedido as string, etaTimestamp: data.eta_timestamp as string | null })
      })
  }, [conversacion.clientes?.telefono, ferreteriaId])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`chat-${conversacion.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `conversacion_id=eq.${conversacion.id}` },
        (payload) => {
          const nuevo = payload.new as Mensaje
          setMensajes((prev) => prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo])
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversaciones', filter: `id=eq.${conversacion.id}` },
        (payload) => {
          const updated = payload.new as { bot_pausado: boolean }
          setBotPausado(updated.bot_pausado)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversacion.id])

  // Texto → mostrar respuestas rápidas si empieza con /
  useEffect(() => {
    if (texto.startsWith('/')) {
      setFiltroRespuesta(texto.slice(1).toLowerCase())
      setShowRespuestas(true)
    } else {
      setShowRespuestas(false)
    }
  }, [texto])

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  async function handleEnviar() {
    const contenido = texto.trim()
    if (!contenido || enviando) return

    setTexto('')
    setError(null)
    setEnviando(true)
    setCitando(null)

    try {
      if (modoNota) {
        // Nota interna (no se envía por WhatsApp)
        const supabase = createClient()
        const { data } = await supabase
          .from('mensajes')
          .insert({
            conversacion_id: conversacion.id,
            role: 'dueno',
            contenido,
            es_nota_interna: true,
            tipo_nota: 'nota',
            responde_a: citando?.id ?? null,
          })
          .select()
          .single()
        if (data) setMensajes(prev => [...prev, data as Mensaje])
      } else {
        const res = await fetch(`/api/conversations/${conversacion.id}/messages`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ texto: contenido, responde_a: citando?.id ?? null }),
        })
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error ?? 'Error al enviar')
        }
        setBotPausado(true)
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setTexto(contenido)
    } finally {
      setEnviando(false)
      inputRef.current?.focus()
    }
  }

  async function handleResumir() {
    setResumiendo(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversacion.id}/resume`, { method: 'POST' })
      if (!res.ok) throw new Error('Error al reactivar el bot')
      setBotPausado(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setResumiendo(false)
    }
  }

  async function handlePausar() {
    setPausando(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversacion.id}/bot-control`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paused: true, motivo: 'owner_dashboard' }),
      })
      if (!res.ok) throw new Error('Error al pausar el bot')
      setBotPausado(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setPausando(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape' && showRespuestas) { setShowRespuestas(false); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  function aplicarRespuesta(r: RespuestaRapida) {
    setTexto(r.contenido)
    setShowRespuestas(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Etiquetas
  async function toggleEtiqueta(etiqueta: Etiqueta) {
    const tieneEtiqueta = etiquetasLocales.some(e => e.id === etiqueta.id)
    if (tieneEtiqueta) {
      await fetch(`/api/bandeja/${conversacion.id}/etiquetas?etiqueta_id=${etiqueta.id}`, { method: 'DELETE' })
      setEtiquetasLocales(prev => prev.filter(e => e.id !== etiqueta.id))
    } else {
      await fetch(`/api/bandeja/${conversacion.id}/etiquetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etiqueta_id: etiqueta.id }),
      })
      setEtiquetasLocales(prev => [...prev, etiqueta])
    }
  }

  const nombreCliente = conversacion.clientes?.nombre ?? conversacion.clientes?.telefono ?? 'Cliente'
  const primerNombre  = nombreCliente.split(' ')[0]
  const telefono      = conversacion.clientes?.telefono ?? ''
  const iniciales     = nombreCliente.trim().split(' ').filter(Boolean)
    .slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')

  const respuestasFiltradas = respuestas.filter(r =>
    r.atajo.includes(filtroRespuesta) || r.contenido.toLowerCase().includes(filtroRespuesta)
  ).slice(0, 6)

  let lastDate = ''
  let lastRole = ''

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-zinc-100 bg-white flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">

          <button
            onClick={() => router.push('/dashboard/conversations')}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition text-zinc-500 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 select-none">
            <span className="text-xs font-bold text-zinc-600">{iniciales || '?'}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-950 leading-tight truncate">{nombreCliente}</p>
              {/* Link al perfil CRM */}
              {conversacion.clientes?.id && (
                <a
                  href={`/dashboard/clientes/${conversacion.clientes.id}`}
                  className="text-zinc-400 hover:text-zinc-700 transition"
                  title="Ver perfil CRM"
                >
                  <User className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {telefono && (
              <p className="text-[11px] text-zinc-400 tabular-nums">+{telefono}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Etiquetas */}
          <div className="relative">
            <button
              onClick={() => setShowEtiquetas(!showEtiquetas)}
              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition relative"
              title="Etiquetas"
            >
              <Tag className="w-4 h-4" />
              {etiquetasLocales.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
              )}
            </button>
            {showEtiquetas && (
              <div className="absolute right-0 top-8 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 min-w-[180px]">
                <p className="px-3 py-1.5 text-[11px] text-zinc-400 font-medium uppercase tracking-wide">Etiquetas</p>
                {etiquetasDisponibles.length === 0 && (
                  <p className="px-3 py-2 text-xs text-zinc-400">Sin etiquetas creadas</p>
                )}
                {etiquetasDisponibles.map(e => {
                  const activa = etiquetasLocales.some(l => l.id === e.id)
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleEtiqueta(e)}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-2 text-sm"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <span className={activa ? 'font-semibold text-zinc-900' : 'text-zinc-600'}>{e.nombre}</span>
                      {activa && <span className="ml-auto text-xs text-indigo-500">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Estado del bot */}
          {botPausado ? (
            <>
              <span className="hidden sm:inline text-[11px] text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full font-medium border border-zinc-200">
                Tú al control
              </span>
              <button
                onClick={handleResumir}
                disabled={resumiendo}
                className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 font-medium"
              >
                <RefreshCw className={cn('w-3 h-3', resumiendo && 'animate-spin')} />
                <span className="hidden sm:inline">Activar bot</span>
                <span className="sm:hidden">Activar</span>
              </button>
            </>
          ) : (
            <>
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-full border border-zinc-100 font-medium">
                <Bot className="w-3 h-3" />
                Bot activo
              </span>
              <button
                onClick={handlePausar}
                disabled={pausando}
                className="text-xs bg-zinc-100 hover:bg-amber-50 hover:text-amber-700 text-zinc-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 font-medium"
              >
                <Bot className={cn('w-3 h-3', pausando && 'animate-pulse')} />
                <span className="hidden sm:inline">Tomar control</span>
                <span className="sm:hidden">Pausar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Etiquetas activas */}
      {etiquetasLocales.length > 0 && (
        <div className="px-4 py-1.5 border-b border-zinc-100 flex gap-1.5 flex-wrap">
          {etiquetasLocales.map(e => (
            <span
              key={e.id}
              className="text-[11px] px-2 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: e.color }}
            >
              {e.nombre}
            </span>
          ))}
        </div>
      )}

      {/* ETA entrega */}
      {etasPedido && (
        <div className="px-4 py-2 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-zinc-500 font-medium">Entrega {etasPedido.numero}:</span>
          <VentanaEntregaBadge etaTimestamp={etasPedido.etaTimestamp} />
        </div>
      )}

      {/* ── Mensajes ──────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ background: 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)' }}
      >
        {mensajes.length === 0 && (
          <p className="text-center text-xs text-zinc-300 mt-16 select-none">Sin mensajes aún</p>
        )}

        {mensajes.map((msg, idx) => {
          const fechaStr      = formatFecha(msg.created_at)
          const showDate      = fechaStr !== lastDate
          const isNotaInterna = msg.es_nota_interna === true
          const isFirst       = msg.role !== lastRole || showDate
          const isLast        = idx === mensajes.length - 1 || mensajes[idx + 1]?.role !== msg.role
          const isDueno       = msg.role === 'dueno'

          lastDate = fechaStr
          lastRole = msg.role

          const styles = getBubbleStyle(msg.role, isNotaInterna)

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-zinc-200/60" />
                  <span className="text-[10px] text-zinc-400 font-medium bg-white px-2.5 py-1 rounded-full border border-zinc-200 select-none">
                    {fechaStr}
                  </span>
                  <div className="flex-1 h-px bg-zinc-200/60" />
                </div>
              )}

              <div
                className={cn('flex flex-col mb-0.5', isLast && 'mb-3', styles.wrap)}
                onDoubleClick={() => !isNotaInterna && setCitando(msg)}
              >
                {isFirst && (
                  <span className={cn(
                    'text-[10px] font-semibold mb-1 px-1 select-none flex items-center gap-1',
                    isDueno ? 'self-end text-zinc-400' : 'text-zinc-400'
                  )}>
                    {isNotaInterna && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                    {msg.role === 'bot' && <Bot className="w-2.5 h-2.5" />}
                    {isNotaInterna ? 'Nota interna' : getRoleLabel(msg.role, primerNombre)}
                  </span>
                )}

                <div className={cn('relative', isDueno ? 'self-end' : 'self-start')}>
                  {isFirst && !isNotaInterna && <BubbleTail role={msg.role} />}

                  <div className={cn(
                    'px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words leading-relaxed',
                    'max-w-[min(400px,72vw)]',
                    styles.bubble
                  )}>
                    {/* Mensaje citado */}
                    {msg.responde_a && (() => {
                      const citado = mensajes.find(m => m.id === msg.responde_a)
                      if (!citado) return null
                      return (
                        <div className={cn(
                          'text-xs mb-2 px-2 py-1.5 rounded-lg border-l-2 opacity-70',
                          isDueno ? 'border-white/40 bg-white/10' : 'border-zinc-400 bg-zinc-100'
                        )}>
                          <p className="font-semibold mb-0.5">{getRoleLabel(citado.role, primerNombre)}</p>
                          <p className="truncate">{citado.contenido}</p>
                        </div>
                      )
                    })()}

                    {/* Audio transcrito */}
                    {msg.tipo === 'audio' && !msg.media_url && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 mb-1.5 select-none">
                        <Mic className="w-3 h-3" />
                        Audio transcrito
                      </span>
                    )}

                    {/* Media */}
                    {msg.media_url && msg.media_tipo && (
                      <div className="mb-2">
                        <MediaBubble url={msg.media_url} tipo={msg.media_tipo} isDueno={isDueno} />
                      </div>
                    )}

                    {/* Texto */}
                    {msg.contenido}

                    {/* Hora */}
                    <span className={cn(
                      'text-[10px] ml-2 float-right mt-1 tabular-nums select-none',
                      styles.time
                    )}>
                      {formatHora(msg.created_at)}
                    </span>
                  </div>
                </div>

                {/* Acción citar (doble-click) hint — solo hover */}
                {!isNotaInterna && (
                  <button
                    onClick={() => setCitando(msg)}
                    className={cn(
                      'opacity-0 hover:opacity-100 text-[10px] text-zinc-400 mt-0.5 px-1 transition-opacity flex items-center gap-0.5',
                      isDueno ? 'self-end' : 'self-start'
                    )}
                    title="Responder este mensaje"
                  >
                    <CornerDownLeft className="w-2.5 h-2.5" />
                    Responder
                  </button>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* ── Cita activa ───────────────────────────────────────────────── */}
      {citando && (
        <div className="mx-4 mb-1 px-3 py-2 bg-zinc-100 border-l-2 border-zinc-400 rounded-r-xl flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-600">{getRoleLabel(citando.role, primerNombre)}</p>
            <p className="text-xs text-zinc-500 truncate">{citando.contenido}</p>
          </div>
          <button onClick={() => setCitando(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Respuestas rápidas ────────────────────────────────────────── */}
      {showRespuestas && respuestasFiltradas.length > 0 && (
        <div className="mx-4 mb-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
          {respuestasFiltradas.map(r => (
            <button
              key={r.id}
              onClick={() => aplicarRespuesta(r)}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">/
                  {r.atajo}
                </span>
                <span className="text-xs text-zinc-600 truncate">{r.contenido}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-zinc-100 bg-white shrink-0">
        {/* Modo nota / mensaje */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setModoNota(false)}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1',
              !modoNota ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            )}
          >
            <Send className="w-2.5 h-2.5" />
            Mensaje
          </button>
          <button
            onClick={() => setModoNota(true)}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1',
              modoNota ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            )}
          >
            <StickyNote className="w-2.5 h-2.5" />
            Nota interna
          </button>
        </div>

        {botPausado && !modoNota && (
          <p className="text-[11px] text-zinc-400 mb-2 select-none">
            El bot está pausado — tus mensajes llegan directamente al cliente
          </p>
        )}
        {modoNota && (
          <p className="text-[11px] text-amber-600 mb-2 select-none">
            <Lock className="inline w-2.5 h-2.5 mr-1" />
            Nota interna — solo visible en el dashboard, no se envía al cliente
          </p>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => { setTexto(e.target.value); autoResize(e.target) }}
            onKeyDown={handleKeyDown}
            placeholder={modoNota ? 'Escribe una nota interna…' : 'Escribe un mensaje… (/ para respuestas rápidas)'}
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm text-zinc-900',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'transition placeholder:text-zinc-400 min-h-[44px] max-h-32 leading-relaxed border',
              modoNota
                ? 'bg-amber-50 border-amber-200 focus:ring-amber-400'
                : 'bg-zinc-50 border-zinc-200 focus:ring-zinc-900 focus:border-zinc-900'
            )}
          />
          <button
            onClick={handleEnviar}
            disabled={!texto.trim() || enviando}
            className={cn(
              'w-11 h-11 rounded-2xl text-white flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0',
              modoNota ? 'bg-amber-500 hover:bg-amber-600' : 'bg-zinc-900 hover:bg-zinc-800'
            )}
          >
            {enviando
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-zinc-300 mt-1.5 select-none">
          Shift+Enter para nueva línea · / para respuestas rápidas · doble-click para citar
        </p>
      </div>

    </div>
  )
}
