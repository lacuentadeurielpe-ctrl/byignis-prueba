'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, truncar, matchesFuzzy } from '@/lib/utils'
import {
  MessageSquare, Search, X, Bot, UserCheck, Timer, Pin,
  Archive, ChevronDown, Bell, BellOff, Check, Circle,
  Clock, CheckCheck, Tag,
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

function getInitials(nombre: string | null, telefono: string): string {
  if (nombre) {
    const words = nombre.trim().split(' ').filter(Boolean)
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    return words[0]?.[0]?.toUpperCase() ?? '?'
  }
  return telefono.slice(-2)
}

const FILTROS: { id: Filtro; label: string; icon?: React.ReactNode }[] = [
  { id: 'todos',     label: 'Todos' },
  { id: 'sin_leer',  label: 'Sin leer' },
  { id: 'abierta',   label: 'Abiertos' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'resuelta',  label: 'Resueltos' },
  { id: 'pausado',   label: 'Tú al control' },
  { id: 'archivada', label: 'Archivados' },
]

const ESTADO_COLOR: Record<string, string> = {
  abierta:   'bg-emerald-500',
  pendiente: 'bg-amber-500',
  esperando: 'bg-blue-500',
  resuelta:  'bg-zinc-400',
}

const ESTADO_LABEL: Record<string, string> = {
  abierta:   'Abierta',
  pendiente: 'Pendiente',
  esperando: 'Esperando',
  resuelta:  'Resuelta',
}

export default function ConversationsList({ inicial, ferreteriaId, initialFiltro }: ConversationsListProps) {
  const router               = useRouter()
  const params               = useParams()
  const conversacionActiva   = params?.id as string | undefined

  const [conversaciones, setConversaciones] = useState(inicial)
  const [busqueda, setBusqueda]             = useState('')
  const [filtro,   setFiltro]               = useState<Filtro>(initialFiltro ?? 'todos')
  const [menuOpen, setMenuOpen]             = useState<string | null>(null)
  const [accionLoading, setAccionLoading]   = useState<string | null>(null)

  // ── Filtrado local ─────────────────────────────────────────────────────────
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
        // 'todos' — excluir archivadas (están en su propio filtro)
        lista = lista.filter(c => !c.archivada)
    }

    // Fijadas primero, luego por actividad
    lista = [...lista].sort((a, b) => {
      if (a.fijada !== b.fijada) return a.fijada ? -1 : 1
      return new Date(b.ultima_actividad).getTime() - new Date(a.ultima_actividad).getTime()
    })

    return lista
  }, [conversaciones, busqueda, filtro])

  // ── Total sin leer (para badge global) ────────────────────────────────────
  const totalSinLeer = useMemo(
    () => conversaciones.filter(c => c.no_leido_count > 0 && !c.archivada).reduce((s, c) => s + c.no_leido_count, 0),
    [conversaciones]
  )

  // ── Realtime ───────────────────────────────────────────────────────────────
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getNombreCliente(conv: ConversacionItem) {
    return conv.clientes?.nombre ?? conv.clientes?.telefono ?? 'Cliente'
  }

  function getTimeAgo(fecha: string) {
    const diff = Date.now() - new Date(fecha).getTime()
    const min  = Math.floor(diff / 60_000)
    if (min < 1)  return 'ahora'
    if (min < 60) return `${min}m`
    const h = Math.floor(min / 60)
    if (h < 24)   return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  function getTimerLabel(hasta: string | null): string | null {
    if (!hasta) return null
    const diff = new Date(hasta).getTime() - Date.now()
    if (diff <= 0) return null
    const min = Math.ceil(diff / 60_000)
    if (min < 60) return `${min}m`
    return `${Math.ceil(min / 60)}h`
  }

  const MOTIVO_LABEL: Record<string, string> = {
    owner_dashboard: 'Dashboard',
    owner_ycloud:    'WhatsApp',
    ia_escalation:   'Escalado IA',
    cliente_pidio:   'Cliente pidió',
  }

  // ── Acciones de bandeja ────────────────────────────────────────────────────
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
      setConversaciones(prev => prev.map(c =>
        c.id === id ? { ...c, [campo]: valor } : c
      ))
    } finally {
      setAccionLoading(null)
      setMenuOpen(null)
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white" onClick={() => setMenuOpen(null)}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-950">Conversaciones</h2>
          {totalSinLeer > 0 && (
            <span className="text-[10px] font-bold bg-emerald-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {totalSinLeer > 99 ? '99+' : totalSinLeer}
            </span>
          )}
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-9 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl
                       focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900
                       transition placeholder:text-zinc-400"
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

        {/* Filtros scrollables */}
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition shrink-0',
                filtro === f.id
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {conversacionesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400">
              {busqueda
                ? 'Sin resultados'
                : filtro !== 'todos'
                  ? 'Sin conversaciones en este filtro'
                  : 'Sin conversaciones aún'}
            </p>
          </div>
        ) : (
          conversacionesFiltradas.map((conv) => {
            const nombre   = getNombreCliente(conv)
            const initials = getInitials(conv.clientes?.nombre ?? null, conv.clientes?.telefono ?? '')
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
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors border-b border-zinc-50 last:border-0',
                    isActive ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                    sinLeer && !isActive && 'bg-emerald-50/50'
                  )}
                >
                  <div className="flex items-center gap-3">

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold select-none',
                        isActive ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                      )}>
                        {initials}
                      </div>
                      {/* Punto estado atencion */}
                      <span className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                        ESTADO_COLOR[conv.estado_atencion] ?? 'bg-zinc-300'
                      )} title={ESTADO_LABEL[conv.estado_atencion]} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {conv.fijada && <Pin className="w-3 h-3 text-zinc-400 shrink-0" />}
                          <p className={cn(
                            'text-sm truncate',
                            isActive     ? 'font-semibold text-zinc-950' : 'font-medium text-zinc-900',
                            sinLeer      ? 'font-semibold' : ''
                          )}>
                            {nombre}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {sinLeer && (
                            <span className="text-[10px] font-bold bg-emerald-500 text-white rounded-full px-1.5 min-w-[18px] text-center">
                              {conv.no_leido_count > 99 ? '99+' : conv.no_leido_count}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-400 tabular-nums">
                            {getTimeAgo(conv.ultima_actividad)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-zinc-400 truncate">
                          {conv.rol_ultimo === 'dueno' && (
                            <span className="text-zinc-500">Tú: </span>
                          )}
                          {conv.ultimo_mensaje
                            ? truncar(conv.ultimo_mensaje, 34)
                            : <span className="italic">Sin mensajes</span>
                          }
                        </p>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Timer auto-resume */}
                          {conv.bot_pausado && conv.bot_pausado_hasta && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                              <Timer className="w-2.5 h-2.5" />
                              {getTimerLabel(conv.bot_pausado_hasta)}
                            </span>
                          )}
                          {conv.bot_pausado && conv.bot_pausado_motivo && !conv.bot_pausado_hasta && (
                            <span className="text-[10px] text-zinc-400">
                              {MOTIVO_LABEL[conv.bot_pausado_motivo] ?? conv.bot_pausado_motivo}
                            </span>
                          )}

                          {/* Toggle bot */}
                          <button
                            onClick={(e) => toggleBotControl(e, conv)}
                            disabled={botControlLoading === conv.id}
                            title={conv.bot_pausado ? 'Reanudar bot' : 'Pausar bot'}
                            className={cn(
                              'p-1 rounded-full transition-colors',
                              conv.bot_pausado
                                ? 'bg-zinc-100 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600'
                                : 'bg-zinc-100 text-zinc-400 hover:bg-amber-50 hover:text-amber-600',
                              botControlLoading === conv.id && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {conv.bot_pausado
                              ? <UserCheck className="w-3 h-3" />
                              : <Bot className="w-3 h-3" />
                            }
                          </button>

                          {/* Menú contextual */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpen(isMenuOpen ? null : conv.id)
                            }}
                            className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400 transition"
                          >
                            <ChevronDown className="w-3 h-3" />
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
                    className="absolute right-2 top-12 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg
                               py-1 min-w-[180px] text-sm"
                  >
                    {sinLeer && (
                      <button
                        onClick={(e) => { marcarLeido(e, conv.id); setMenuOpen(null) }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700"
                      >
                        <CheckCheck className="w-4 h-4" /> Marcar como leído
                      </button>
                    )}
                    <button
                      onClick={() => cambiarEstado(conv.id, 'fijada', !conv.fijada)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700"
                    >
                      <Pin className="w-4 h-4" /> {conv.fijada ? 'Desfijar' : 'Fijar'}
                    </button>
                    <button
                      onClick={() => cambiarEstado(conv.id, 'archivada', !conv.archivada)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700"
                    >
                      <Archive className="w-4 h-4" /> {conv.archivada ? 'Desarchivar' : 'Archivar'}
                    </button>
                    <div className="border-t border-zinc-100 my-1" />
                    <p className="px-3 py-1 text-[11px] text-zinc-400 font-medium uppercase tracking-wide">Estado</p>
                    {(['abierta','pendiente','esperando','resuelta'] as const).map(est => (
                      <button
                        key={est}
                        onClick={() => cambiarEstado(conv.id, 'estado_atencion', est)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-2',
                          conv.estado_atencion === est ? 'text-zinc-900 font-medium' : 'text-zinc-600'
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full', ESTADO_COLOR[est])} />
                        {ESTADO_LABEL[est]}
                        {conv.estado_atencion === est && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                    ))}
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
