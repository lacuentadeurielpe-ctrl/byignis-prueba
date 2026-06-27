'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatFecha, formatHora } from '@/lib/utils'
import {
  Send, RefreshCw, ArrowLeft, Bot, Mic, Image as ImageIcon,
  FileText, X, CornerDownLeft, Lock, ChevronRight, Tag, User,
  Paperclip, StickyNote, Search, MoreVertical, Phone,
  CheckCheck, Check, Smile,
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

// Colores de avatar (misma función que ConversationsList)
const AVATAR_COLORS = [
  '#d97706','#059669','#7c3aed','#db2777','#2563eb',
  '#dc2626','#0891b2','#65a30d','#9333ea','#ea580c',
]
function getAvatarColor(texto: string): string {
  let hash = 0
  for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getRoleLabel(role: string, primerNombre: string): string {
  if (role === 'cliente') return primerNombre
  if (role === 'bot')     return 'Bot'
  if (role === 'dueno')   return 'Tú'
  return role
}

// ── Media Render ────────────────────────────────────────────────────────────
function MediaBubble({ url, tipo, isOutgoing }: { url: string; tipo: string; isOutgoing: boolean }) {
  if (tipo === 'imagen') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt="Imagen"
          className="rounded-lg max-w-[240px] max-h-[240px] object-cover cursor-pointer hover:opacity-90 transition"
          loading="lazy"
        />
      </a>
    )
  }
  if (tipo === 'audio') {
    return <audio controls src={url} className="max-w-[220px] h-10" />
  }
  if (tipo === 'video') {
    return (
      <video controls src={url} className="rounded-lg max-w-[240px] max-h-[240px]">
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
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:opacity-80 transition"
        style={{
          backgroundColor: isOutgoing ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)',
          color: isOutgoing ? '#111b21' : '#111b21',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
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

  const [mensajes,        setMensajes]       = useState<Mensaje[]>(mensajesIniciales)
  const [botPausado,      setBotPausado]      = useState(conversacion.bot_pausado)
  const [texto,           setTexto]           = useState('')
  const [enviando,        setEnviando]        = useState(false)
  const [resumiendo,      setResumiendo]      = useState(false)
  const [pausando,        setPausando]        = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [modoNota,        setModoNota]        = useState(false)
  const [citando,         setCitando]         = useState<Mensaje | null>(null)
  const [etasPedido, setEtasPedido] = useState<{ numero: string; etaTimestamp: string | null } | null>(null)

  const [respuestas,      setRespuestas]      = useState<RespuestaRapida[]>([])
  const [showRespuestas,  setShowRespuestas]  = useState(false)
  const [filtroRespuesta, setFiltroRespuesta] = useState('')

  const [etiquetasLocales, setEtiquetasLocales] = useState<Etiqueta[]>(etiquetasConv)
  const [showEtiquetas,    setShowEtiquetas]    = useState(false)
  const [showMenu,         setShowMenu]         = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  useEffect(() => {
    fetch('/api/respuestas-rapidas')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRespuestas(data) })
      .catch(() => {})
  }, [])

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

  useEffect(() => {
    if (texto.startsWith('/')) {
      setFiltroRespuesta(texto.slice(1).toLowerCase())
      setShowRespuestas(true)
    } else {
      setShowRespuestas(false)
    }
  }, [texto])

  async function handleEnviar() {
    const contenido = texto.trim()
    if (!contenido || enviando) return
    setTexto('')
    setError(null)
    setEnviando(true)
    setCitando(null)
    try {
      if (modoNota) {
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
        const body = await res.json()
        if (!res.ok) {
          throw new Error(body.error ?? 'Error al enviar')
        }
        // Agregar el mensaje localmente (la subscripción realtime lo deduplica
        // por id). Evitamos router.refresh(), que en carrera con la navegación
        // duplicaba el render de la página.
        if (body?.id) {
          setMensajes(prev => prev.some(m => m.id === body.id) ? prev : [...prev, body as Mensaje])
        }
        setBotPausado(true)
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
  const avatarBg      = getAvatarColor(nombreCliente)

  const respuestasFiltradas = respuestas.filter(r =>
    r.atajo.includes(filtroRespuesta) || r.contenido.toLowerCase().includes(filtroRespuesta)
  ).slice(0, 6)

  let lastDate = ''

  return (
    <div
      className="flex flex-col h-full"
      onClick={() => { setShowEtiquetas(false); setShowMenu(false) }}
    >

      {/* ── Header WhatsApp ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ backgroundColor: '#075e54', minHeight: 60 }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard/conversations')}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white select-none shrink-0"
            style={{ backgroundColor: avatarBg }}
          >
            {iniciales || '?'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white leading-tight truncate">{nombreCliente}</p>
              {conversacion.clientes?.id && (
                <a
                  href={`/dashboard/clientes/${conversacion.clientes.id}`}
                  className="text-white/60 hover:text-white/90 transition"
                  title="Ver perfil CRM"
                >
                  <User className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-white/70 tabular-nums">
              {botPausado
                ? '✏️ Tú al control'
                : <span className="flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> Bot activo</span>
              }
            </p>
          </div>
        </div>

        {/* Acciones header */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Etiquetas */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowEtiquetas(!showEtiquetas); setShowMenu(false) }}
              className="p-2 rounded-full hover:bg-white/10 transition relative text-white/80"
              title="Etiquetas"
            >
              <Tag className="w-4 h-4" />
              {etiquetasLocales.length > 0 && (
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#25d366' }}
                />
              )}
            </button>
            {showEtiquetas && (
              <div
                className="absolute right-0 top-10 z-50 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden"
                style={{ backgroundColor: '#ffffff', border: '1px solid #e9edef' }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8696a0' }}>
                  Etiquetas
                </p>
                {etiquetasDisponibles.length === 0 && (
                  <p className="px-4 py-2 text-xs" style={{ color: '#8696a0' }}>Sin etiquetas creadas</p>
                )}
                {etiquetasDisponibles.map(e => {
                  const activa = etiquetasLocales.some(l => l.id === e.id)
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleEtiqueta(e)}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-3 text-sm"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <span style={{ color: '#111b21', fontWeight: activa ? 600 : 400 }}>{e.nombre}</span>
                      {activa && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: '#25d366' }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Menú más opciones */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowEtiquetas(false) }}
              className="p-2 rounded-full hover:bg-white/10 transition text-white/80"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-10 z-50 rounded-xl shadow-2xl py-1 min-w-[200px] overflow-hidden"
                style={{ backgroundColor: '#ffffff', border: '1px solid #e9edef' }}
                onClick={(e) => e.stopPropagation()}
              >
                {botPausado ? (
                  <button
                    onClick={() => { handleResumir(); setShowMenu(false) }}
                    disabled={resumiendo}
                    className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-3 text-sm disabled:opacity-50"
                    style={{ color: '#111b21' }}
                  >
                    <RefreshCw className={cn('w-4 h-4', resumiendo && 'animate-spin')} style={{ color: '#8696a0' }} />
                    Activar bot
                  </button>
                ) : (
                  <button
                    onClick={() => { handlePausar(); setShowMenu(false) }}
                    disabled={pausando}
                    className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-3 text-sm disabled:opacity-50"
                    style={{ color: '#111b21' }}
                  >
                    <Bot className={cn('w-4 h-4', pausando && 'animate-pulse')} style={{ color: '#8696a0' }} />
                    Tomar control
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Etiquetas activas */}
      {etiquetasLocales.length > 0 && (
        <div
          className="flex gap-1.5 px-4 py-1.5 flex-wrap shrink-0"
          style={{ backgroundColor: '#f0f2f5', borderBottom: '1px solid #e9edef' }}
        >
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
        <div
          className="flex items-center gap-2 px-4 py-2 shrink-0"
          style={{ backgroundColor: '#f0f2f5', borderBottom: '1px solid #e9edef' }}
        >
          <span className="text-[11px] font-medium" style={{ color: '#667781' }}>
            Entrega {etasPedido.numero}:
          </span>
          <VentanaEntregaBadge etaTimestamp={etasPedido.etaTimestamp} />
        </div>
      )}

      {/* ── Área de mensajes ────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5"
        style={{
          // Fondo papel de WhatsApp
          backgroundColor: '#efeae2',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d9d0c7' fill-opacity='0.3' fill-rule='evenodd'%3E%3Cpath d='M0 200L200 0L400 200L200 400z' /%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '400px 400px',
        }}
      >
        {mensajes.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span
              className="text-xs px-4 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: '#667781' }}
            >
              Sin mensajes aún
            </span>
          </div>
        )}

        {mensajes.map((msg, idx) => {
          const fechaStr      = formatFecha(msg.created_at)
          const showDate      = fechaStr !== lastDate
          const isNotaInterna = msg.es_nota_interna === true
          const isOutgoing    = msg.role === 'dueno' || (msg.role === 'bot' && !isNotaInterna)
          const isDueno       = msg.role === 'dueno'
          const isBot         = msg.role === 'bot'

          lastDate = fechaStr

          // Colores de burbuja
          let bubbleBg: string
          let bubbleText: string
          let tailColor: string

          if (isNotaInterna) {
            bubbleBg   = '#fff8e5'
            bubbleText = '#92400e'
            tailColor  = '#fff8e5'
          } else if (isDueno) {
            bubbleBg   = '#d9fdd3'
            bubbleText = '#111b21'
            tailColor  = '#d9fdd3'
          } else if (isBot) {
            bubbleBg   = '#f0f2f5'
            bubbleText = '#111b21'
            tailColor  = '#f0f2f5'
          } else {
            // cliente
            bubbleBg   = '#ffffff'
            bubbleText = '#111b21'
            tailColor  = '#ffffff'
          }

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center justify-center my-3">
                  <span
                    className="text-[11px] font-medium px-3 py-1 rounded-lg select-none shadow-sm"
                    style={{ backgroundColor: '#e1f3fb', color: '#54656f' }}
                  >
                    {fechaStr}
                  </span>
                </div>
              )}

              <div
                className={cn(
                  'flex mb-0.5',
                  isNotaInterna ? 'justify-center' : isOutgoing ? 'justify-end' : 'justify-start'
                )}
                onDoubleClick={() => !isNotaInterna && setCitando(msg)}
              >
                {/* Nota interna: burbuja centrada amarilla */}
                {isNotaInterna ? (
                  <div
                    className="max-w-[80%] px-4 py-2.5 rounded-xl text-xs shadow-sm"
                    style={{ backgroundColor: bubbleBg, color: bubbleText, border: '1px solid #fde68a' }}
                  >
                    <div className="flex items-center gap-1.5 mb-1 opacity-70">
                      <Lock className="w-3 h-3" />
                      <span className="font-semibold text-[10px] uppercase tracking-wide">Nota interna</span>
                    </div>
                    {msg.contenido}
                    <span className="text-[10px] ml-2 float-right mt-1 opacity-60 tabular-nums">
                      {formatHora(msg.created_at)}
                    </span>
                  </div>
                ) : (
                  <div className={cn('flex flex-col', isOutgoing ? 'items-end' : 'items-start')}>
                    {/* Label bot */}
                    {isBot && (
                      <span className="text-[10px] flex items-center gap-1 mb-0.5 px-1" style={{ color: '#8696a0' }}>
                        <Bot className="w-2.5 h-2.5" /> Bot
                      </span>
                    )}

                    {/* Burbuja */}
                    <div
                      className="relative max-w-[min(360px,70vw)] rounded-xl shadow-sm overflow-hidden"
                      style={{ backgroundColor: bubbleBg }}
                    >
                      {/* Cola de la burbuja (SVG clip-path approach) */}
                      {!isOutgoing && (
                        <div
                          className="absolute -left-[6px] top-0 w-0 h-0"
                          style={{
                            borderRight: `7px solid ${tailColor}`,
                            borderBottom: '7px solid transparent',
                          }}
                        />
                      )}
                      {isOutgoing && (
                        <div
                          className="absolute -right-[6px] top-0 w-0 h-0"
                          style={{
                            borderLeft: `7px solid ${tailColor}`,
                            borderBottom: '7px solid transparent',
                          }}
                        />
                      )}

                      <div className="px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed"
                        style={{ color: bubbleText }}
                      >
                        {/* Mensaje citado */}
                        {msg.responde_a && (() => {
                          const citado = mensajes.find(m => m.id === msg.responde_a)
                          if (!citado) return null
                          return (
                            <div
                              className="text-xs mb-2 px-2 py-1.5 rounded-lg border-l-[3px]"
                              style={{
                                backgroundColor: 'rgba(0,0,0,0.06)',
                                borderColor: isOutgoing ? '#25d366' : '#53bdeb',
                              }}
                            >
                              <p className="font-semibold mb-0.5" style={{ color: isOutgoing ? '#25d366' : '#53bdeb' }}>
                                {getRoleLabel(citado.role, primerNombre)}
                              </p>
                              <p className="truncate opacity-80">{citado.contenido}</p>
                            </div>
                          )
                        })()}

                        {/* Audio transcrito label */}
                        {msg.tipo === 'audio' && !msg.media_url && (
                          <span className="flex items-center gap-1 text-[10px] font-medium mb-1.5 select-none opacity-60">
                            <Mic className="w-3 h-3" />
                            Audio transcrito
                          </span>
                        )}

                        {/* Media */}
                        {msg.media_url && msg.media_tipo && (
                          <div className="mb-2">
                            <MediaBubble url={msg.media_url} tipo={msg.media_tipo} isOutgoing={isOutgoing} />
                          </div>
                        )}

                        {/* Texto */}
                        <span>{msg.contenido}</span>

                        {/* Hora + checks inline */}
                        <span className="inline-flex items-center gap-1 ml-2 float-right mt-1">
                          <span className="text-[10px] tabular-nums select-none" style={{ color: '#8696a0' }}>
                            {formatHora(msg.created_at)}
                          </span>
                          {isOutgoing && (
                            <CheckCheck className="w-3 h-3 shrink-0" style={{ color: '#53bdeb' }} />
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Botón citar (hover) */}
                    <button
                      onClick={() => setCitando(msg)}
                      className="opacity-0 hover:opacity-100 text-[10px] mt-0.5 px-1 transition-opacity flex items-center gap-0.5"
                      style={{ color: '#8696a0' }}
                      title="Responder"
                    >
                      <CornerDownLeft className="w-2.5 h-2.5" />
                      Responder
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="mx-3 mb-1 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
        >
          {error}
        </div>
      )}

      {/* ── Cita activa ──────────────────────────────────────────── */}
      {citando && (
        <div
          className="mx-3 mb-1 px-3 py-2 rounded-lg flex items-start justify-between gap-2"
          style={{ backgroundColor: '#f0f2f5', borderLeft: '4px solid #25d366' }}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold" style={{ color: '#25d366' }}>
              {getRoleLabel(citando.role, primerNombre)}
            </p>
            <p className="text-xs truncate" style={{ color: '#667781' }}>{citando.contenido}</p>
          </div>
          <button onClick={() => setCitando(null)} className="shrink-0" style={{ color: '#8696a0' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Respuestas rápidas ────────────────────────────────────── */}
      {showRespuestas && respuestasFiltradas.length > 0 && (
        <div
          className="mx-3 mb-1 rounded-xl shadow-lg overflow-hidden"
          style={{ backgroundColor: '#ffffff', border: '1px solid #e9edef' }}
        >
          {respuestasFiltradas.map(r => (
            <button
              key={r.id}
              onClick={() => aplicarRespuesta(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 transition"
              style={{ borderBottom: '1px solid #f0f2f5' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: '#e8f5e9', color: '#075e54' }}
                >
                  /{r.atajo}
                </span>
                <span className="text-xs truncate" style={{ color: '#667781' }}>{r.contenido}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Input área WhatsApp ───────────────────────────────────── */}
      <div
        className="px-3 py-2 shrink-0"
        style={{ backgroundColor: '#f0f2f5' }}
      >
        {/* Toggle nota / mensaje */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setModoNota(false)}
            className="text-[11px] px-3 py-1 rounded-full font-medium transition"
            style={!modoNota
              ? { backgroundColor: '#075e54', color: '#ffffff' }
              : { backgroundColor: '#e9edef', color: '#667781' }
            }
          >
            <Send className="w-2.5 h-2.5 inline mr-1" />
            Mensaje
          </button>
          <button
            onClick={() => setModoNota(true)}
            className="text-[11px] px-3 py-1 rounded-full font-medium transition flex items-center gap-1"
            style={modoNota
              ? { backgroundColor: '#f59e0b', color: '#ffffff' }
              : { backgroundColor: '#e9edef', color: '#667781' }
            }
          >
            <StickyNote className="w-2.5 h-2.5" />
            Nota interna
          </button>
        </div>

        {/* Info contextual */}
        {!modoNota && botPausado && (
          <p className="text-[11px] mb-2 px-1 select-none" style={{ color: '#8696a0' }}>
            Tú al control — los mensajes llegan directamente al cliente
          </p>
        )}
        {modoNota && (
          <p className="text-[11px] mb-2 px-1 select-none" style={{ color: '#92400e' }}>
            <Lock className="inline w-2.5 h-2.5 mr-1" />
            Nota interna — no se envía al cliente
          </p>
        )}

        {/* Barra de input */}
        <div className="flex items-end gap-2">
          <div
            className="flex-1 flex items-end rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#ffffff' }}
          >
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); autoResize(e.target) }}
              onKeyDown={handleKeyDown}
              placeholder={modoNota ? 'Escribe una nota interna…' : 'Escribe un mensaje…'}
              rows={1}
              className="flex-1 resize-none px-4 py-3 text-sm focus:outline-none min-h-[46px] max-h-32 leading-relaxed"
              style={{
                backgroundColor: 'transparent',
                color: '#111b21',
              }}
            />
          </div>

          {/* Botón enviar (círculo verde) */}
          <button
            onClick={handleEnviar}
            disabled={!texto.trim() || enviando}
            className="w-11 h-11 rounded-full flex items-center justify-center transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: modoNota ? '#f59e0b' : '#25d366' }}
          >
            {enviando
              ? <RefreshCw className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>

        <p className="text-[10px] mt-1.5 px-1 select-none" style={{ color: '#8696a0' }}>
          Enter para enviar · Shift+Enter nueva línea · / para respuestas rápidas
        </p>
      </div>

    </div>
  )
}
