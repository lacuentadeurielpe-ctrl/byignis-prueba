'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, truncar, matchesFuzzy } from '@/lib/utils'
import {
  Search, X, Bot, UserCheck, Timer, Pin,
  Archive, MoreVertical, CheckCheck, Check, Filter,
} from 'lucide-react'

interface Etiqueta {
  id: string
  nombre: string
  color: string
}

interface ConversacionItem {
  id: string
  estado: string
  bot_pausado: boolean
  bot_pausado_hasta: string | null
  bot_pausado_motivo: string | null
  ultima_actividad: string
  no_leido_count: number
  estado_atencion: 'abierta' | 'pendiente' | 'esperando' | 'resuelta'
  archivada: boolean
  fijada: boolean
  snooze_hasta: string | null
  asignado_a: string | null
  clientes: { nombre: string | null; telefono: string } | null
  ultimo_mensaje?: string
  rol_ultimo?: string
  etiquetas?: Etiqueta[]
}

interface ConversationsListProps {
  inicial: ConversacionItem[]
  ferreteriaId: string
  initialFiltro?: Filtro
}

type Filtro = 'todos' | 'pausado' | 'bot' | 'abierta' | 'pendiente' | 'esperando' | 'resuelta' | 'archivada' | 'sin_leer'

// Colores de avatar al estilo WhatsApp (una por inicial)
const AVATAR_COLORS = [
  '#d97706','#059669','#7c3aed','#db2777','#2563eb',
  '#dc2626','#0891b2','#65a30d','#9333ea','#ea580c',
]

function getAvatarColor(texto: string): string {
  let hash = 0
  for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(nombre: string | null, telefono: string): string {
  if (nombre) {
    const words = nombre.trim().split(' ').filter(Boolean)
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    return words[0]?.[0]?.toUpperCase() ?? '?'
  }
  return telefono.slice(-2)
}

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos',     label: 'Todos' },
  { id: 'sin_leer',  label: 'No leídos' },
  { id: 'abierta',   label: 'Abiertos' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'resuelta',  label: 'Resueltos' },
  { id: 'pausado',   label: 'Tú al control' },
  { id: 'archivada', label: 'Archivados' },
]

export default function ConversationsList({ inicial, ferreteriaId, initialFiltro }: ConversationsListProps) {
  const router               = useRouter()
  const params               = useParams()
  const conversacionActiva   = params?.id as string | undefined

  const [conversaciones, setConversaciones] = useState(inicial)
  const [busqueda, setBusqueda]             = useState('')
  const [filtro,   setFiltro]               = useState<Filtro>(initialFiltro ?? 'todos')
  const [menuOpen, setMenuOpen]             = useState<string | null>(null)
  const [accionLoading, setAccionLoading]   = useState<string | null>(null)
  const [showFiltros, setShowFiltros]       = useState(false)

  const conversacionesFiltradas = useMemo(() => {
    let lista = conversaciones

    if (busqueda) {
      lista = lista.filter((conv) => {
        const nombre = conv.clientes?.nombre ?? ''
        const tel    = conv.clientes?.telefono ?? ''
        const msg    = conv.ultimo_mensaje ?? ''
        return matchesFuzzy(`${nombre} ${tel} ${msg}`, busqueda)
      })
    }

    switch (filtro) {
      case 'sin_leer':  lista = lista.filter(c => c.no_leido_count > 0 && !c.archivada); break
      case 'pausado':   lista = lista.filter(c =>  c.bot_pausado && !c.archivada); break
      case 'bot':       lista = lista.filter(c => !c.bot_pausado && !c.archivada); break
      case 'archivada': lista = lista.filter(c =>  c.archivada); break
      case 'abierta':
      case 'pendiente':
      case 'esperando':
      case 'resuelta':
        lista = lista.filter(c => c.estado_atencion === filtro && !c.archivada)
        break
      default:
        lista = lista.filter(c => !c.archivada)
    }

    lista = [...lista].sort((a, b) => {
      if (a.fijada !== b.fijada) return a.fijada ? -1 : 1
      return new Date(b.ultima_actividad).getTime() - new Date(a.ultima_actividad).getTime()
    })

    return lista
  }, [conversaciones, busqueda, filtro])

  const totalSinLeer = useMemo(
    () => conversaciones.filter(c => c.no_leido_count > 0 && !c.archivada).reduce((s, c) => s + c.no_leido_count, 0),
    [conversaciones]
  )

  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`conversaciones-${ferreteriaId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversaciones', filter: `ferreteria_id=eq.${ferreteriaId}` },
        () => { router.refresh() }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        () => { router.refresh() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ferreteriaId, router])

  function getNombreCliente(conv: ConversacionItem) {
    return conv.clientes?.nombre ?? conv.clientes?.telefono ?? 'Cliente'
  }

  function getTimeAgo(fecha: string) {
    const d    = new Date(fecha)
    const now  = new Date()
    const diff = now.getTime() - d.getTime()
    const min  = Math.floor(diff / 60_000)
    if (min < 1)  return 'ahora'
    if (min < 60) return `${min}m`
    const h = Math.floor(min / 60)
    if (h < 24) return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })
    if (h < 48)  return 'ayer'
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
  }

  function getTimerLabel(hasta: string | null): string | null {
    if (!hasta) return null
    const diff = new Date(hasta).getTime() - Date.now()
    if (diff <= 0) return null
    const min = Math.ceil(diff / 60_000)
    return min < 60 ? `${min}m` : `${Math.ceil(min / 60)}h`
  }

  const [botControlLoading, setBotControlLoading] = useState<string | null>(null)

  const toggleBotControl = useCallback(async (e: React.MouseEvent, conv: ConversacionItem) => {
    e.stopPropagation()
    setBotControlLoading(conv.id)
    try {
      await fetch(`/api/conversations/${conv.id}/bot-control`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          conv.bot_pausado
            ? { paused: false }
            : { paused: true, motivo: 'owner_dashboard' }
        ),
      })
      router.refresh()
    } finally {
      setBotControlLoading(null)
    }
  }, [router])

  const marcarLeido = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await fetch(`/api/bandeja/${id}/leer`, { method: 'POST' })
    setConversaciones(prev => prev.map(c => c.id === id ? { ...c, no_leido_count: 0 } : c))
  }, [])

  const cambiarEstado = useCallback(async (id: string, campo: string, valor: unknown) => {
    setAccionLoading(id)
    try {
      await fetch(`/api/bandeja/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor }),
      })
      setConversaciones(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c))
    } finally {
      setAccionLoading(null)
      setMenuOpen(null)
    }
  }, [])

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#ffffff' }}
      onClick={() => { setMenuOpen(null); setShowFiltros(false) }}
    >

      {/* ── Header estilo WhatsApp ─────────────────────────────────── */}
      <div style={{ backgroundColor: '#075e54' }} className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white tracking-wide">Mensajes</h2>
          <div className="flex items-center gap-1">
            {totalSinLeer > 0 && (
              <span
                className="text-[11px] font-bold text-white rounded-full px-2 py-0.5 min-w-[20px] text-center"
                style={{ backgroundColor: '#25d366' }}
              >
                {totalSinLeer > 99 ? '99+' : totalSinLeer}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowFiltros(!showFiltros) }}
              className="p-1.5 rounded-full hover:bg-white/10 transition text-white/80"
              title="Filtros"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar o empezar un chat"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg focus:outline-none placeholder:text-zinc-400 text-zinc-800"
            style={{ backgroundColor: '#f0f2f5' }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filtros desplegables */}
      {showFiltros && (
        <div
          className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide shrink-0 border-b"
          style={{ backgroundColor: '#f0f2f5', borderColor: '#e9edef' }}
          onClick={(e) => e.stopPropagation()}
        >
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition shrink-0 border',
                filtro === f.id
                  ? 'text-white border-transparent'
                  : 'text-zinc-600 bg-white border-zinc-200 hover:bg-zinc-100'
              )}
              style={filtro === f.id ? { backgroundColor: '#075e54', borderColor: '#075e54' } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Filtro activo pill */}
      {filtro !== 'todos' && !showFiltros && (
        <div
          className="flex items-center gap-2 px-4 py-1.5 text-xs shrink-0 border-b"
          style={{ backgroundColor: '#f0f2f5', borderColor: '#e9edef' }}
        >
          <span className="text-zinc-500">Filtrando:</span>
          <span className="font-medium text-zinc-700">{FILTROS.find(f => f.id === filtro)?.label}</span>
          <button
            onClick={() => setFiltro('todos')}
            className="ml-auto text-zinc-400 hover:text-zinc-700 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Lista ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
        {conversacionesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: '#f0f2f5' }}
            >
              <Search className="w-7 h-7" style={{ color: '#8696a0' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#111b21' }}>
              {busqueda ? 'Sin resultados' : filtro !== 'todos' ? 'Sin conversaciones aquí' : 'Sin conversaciones aún'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#8696a0' }}>
              {busqueda ? 'Intenta con otro término' : 'Los chats de WhatsApp aparecerán aquí'}
            </p>
          </div>
        ) : (
          conversacionesFiltradas.map((conv) => {
            const nombre   = getNombreCliente(conv)
            const initials = getInitials(conv.clientes?.nombre ?? null, conv.clientes?.telefono ?? '')
            const avatarBg = getAvatarColor(nombre)
            const isActive = conversacionActiva === conv.id
            const sinLeer  = conv.no_leido_count > 0
            const isMenuOpen = menuOpen === conv.id

            return (
              <div key={conv.id} className="relative">
                <button
                  onClick={() => {
                    router.push(`/dashboard/conversations/${conv.id}`)
                    if (sinLeer) fetch(`/api/bandeja/${conv.id}/leer`, { method: 'POST' })
                      .then(() => setConversaciones(prev => prev.map(c => c.id === conv.id ? { ...c, no_leido_count: 0 } : c)))
                  }}
                  className="w-full text-left transition-colors"
                  style={{
                    backgroundColor: isActive ? '#f0f2f5' : undefined,
                    borderBottom: '1px solid #e9edef',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f6f6' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                >
                  <div className="flex items-center gap-3 px-4 py-3">

                    {/* Avatar WhatsApp style */}
                    <div className="relative shrink-0">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white select-none"
                        style={{ backgroundColor: avatarBg }}
                      >
                        {initials}
                      </div>
                      {/* Pin indicator */}
                      {conv.fijada && (
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#8696a0' }}
                        >
                          <Pin className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Fila superior: nombre + hora */}
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className="text-sm truncate"
                          style={{
                            fontWeight: sinLeer ? 600 : 500,
                            color: '#111b21',
                          }}
                        >
                          {nombre}
                        </p>
                        <span
                          className="text-[11px] shrink-0 tabular-nums"
                          style={{ color: sinLeer ? '#25d366' : '#667781' }}
                        >
                          {getTimeAgo(conv.ultima_actividad)}
                        </span>
                      </div>

                      {/* Fila inferior: preview + badge */}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {/* Checkmarks de estado */}
                          {conv.rol_ultimo === 'dueno' && (
                            <CheckCheck className="w-3.5 h-3.5 shrink-0" style={{ color: '#53bdeb' }} />
                          )}
                          {/* Bot indicator */}
                          {!conv.bot_pausado && conv.rol_ultimo !== 'dueno' && (
                            <Bot className="w-3 h-3 shrink-0" style={{ color: '#8696a0' }} />
                          )}
                          {/* Paused indicator */}
                          {conv.bot_pausado && conv.bot_pausado_hasta && (
                            <Timer className="w-3 h-3 shrink-0" style={{ color: '#f59e0b' }} />
                          )}
                          <p
                            className="text-xs truncate"
                            style={{
                              color: '#667781',
                              fontWeight: sinLeer ? 500 : 400,
                            }}
                          >
                            {conv.ultimo_mensaje
                              ? truncar(conv.ultimo_mensaje, 38)
                              : <span className="italic">Sin mensajes</span>
                            }
                          </p>
                        </div>

                        {/* Right: badge + actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {sinLeer && (
                            <span
                              className="text-[10px] font-bold text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
                              style={{ backgroundColor: '#25d366' }}
                            >
                              {conv.no_leido_count > 99 ? '99+' : conv.no_leido_count}
                            </span>
                          )}

                          {/* Bot toggle */}
                          <button
                            onClick={(e) => toggleBotControl(e, conv)}
                            disabled={botControlLoading === conv.id}
                            title={conv.bot_pausado ? 'Reanudar bot' : 'Pausar bot'}
                            className="p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            style={{ opacity: isMenuOpen ? 1 : undefined }}
                          >
                            {conv.bot_pausado
                              ? <UserCheck className="w-3.5 h-3.5" style={{ color: '#25d366' }} />
                              : <Bot className="w-3.5 h-3.5" style={{ color: '#8696a0' }} />
                            }
                          </button>

                          {/* Menú contextual */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpen(isMenuOpen ? null : conv.id)
                            }}
                            className="p-1 rounded-full hover:bg-zinc-100 transition"
                          >
                            <MoreVertical className="w-3.5 h-3.5" style={{ color: '#8696a0' }} />
                          </button>
                        </div>
                      </div>

                      {/* Etiquetas */}
                      {conv.etiquetas && conv.etiquetas.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {conv.etiquetas.map(e => (
                            <span
                              key={e.id}
                              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                              style={{ backgroundColor: e.color }}
                            >
                              {e.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </button>

                {/* Menú contextual */}
                {isMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-2 top-12 z-50 rounded-xl shadow-xl py-1 min-w-[180px] text-sm overflow-hidden"
                    style={{ backgroundColor: '#ffffff', border: '1px solid #e9edef' }}
                  >
                    {sinLeer && (
                      <button
                        onClick={(e) => { marcarLeido(e, conv.id); setMenuOpen(null) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-3"
                        style={{ color: '#111b21' }}
                      >
                        <Check className="w-4 h-4" style={{ color: '#8696a0' }} />
                        Marcar como leído
                      </button>
                    )}
                    <button
                      onClick={() => cambiarEstado(conv.id, 'fijada', !conv.fijada)}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-3"
                      style={{ color: '#111b21' }}
                    >
                      <Pin className="w-4 h-4" style={{ color: '#8696a0' }} />
                      {conv.fijada ? 'Desfijar chat' : 'Fijar chat'}
                    </button>
                    <button
                      onClick={() => cambiarEstado(conv.id, 'archivada', !conv.archivada)}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 flex items-center gap-3"
                      style={{ color: '#111b21' }}
                    >
                      <Archive className="w-4 h-4" style={{ color: '#8696a0' }} />
                      {conv.archivada ? 'Desarchivar' : 'Archivar chat'}
                    </button>
                    <div style={{ borderTop: '1px solid #e9edef', margin: '4px 0' }} />
                    <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8696a0' }}>
                      Estado
                    </p>
                    {(['abierta','pendiente','esperando','resuelta'] as const).map(est => {
                      const colors: Record<string, string> = {
                        abierta: '#10b981', pendiente: '#f59e0b',
                        esperando: '#3b82f6', resuelta: '#9ca3af',
                      }
                      return (
                        <button
                          key={est}
                          onClick={() => cambiarEstado(conv.id, 'estado_atencion', est)}
                          className="w-full text-left px-4 py-2 hover:bg-zinc-50 flex items-center gap-3"
                          style={{ color: conv.estado_atencion === est ? '#111b21' : '#667781', fontWeight: conv.estado_atencion === est ? 600 : 400 }}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[est] }} />
                          {{ abierta: 'Abierta', pendiente: 'Pendiente', esperando: 'Esperando', resuelta: 'Resuelta' }[est]}
                          {conv.estado_atencion === est && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: '#25d366' }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
