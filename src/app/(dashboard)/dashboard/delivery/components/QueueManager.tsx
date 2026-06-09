'use client'

/**
 * QueueManager — Gestión manual de la cola de delivery
 *
 * Permite al dueño/vendedor:
 *   - Ver la cola ordenada por score/prioridad
 *   - Cambiar la prioridad de un pedido
 *   - Bloquear un pedido temporalmente
 *   - Reagendar un pedido para una fecha/hora futura
 *   - Cancelar un pedido de la cola
 *   - Asignar manualmente a un repartidor disponible
 */

import { useState } from 'react'
import {
  ListOrdered, Loader2, RefreshCw, Clock, ChevronUp, ChevronDown,
  CalendarClock, X, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { cn, formatPEN, formatFechaHoraLima } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueueItem {
  id:          string
  pedido_id:   string
  prioridad:   number
  score:       number
  estado:      string
  peso_total_kg: number | null
  no_antes_de: string | null
  no_despues_de: string | null
  bloqueado_hasta: string | null
  intentos:    number
  max_intentos: number
  reagendado_para: string | null
  pedidos?: {
    numero_pedido: string
    nombre_cliente: string
    total: number
    direccion_entrega: string | null
  } | null
  repartidor_pref?: { nombre: string } | null
}

interface RepartidorDisponible {
  id:     string
  nombre: string
}

interface QueueManagerProps {
  items:         QueueItem[]
  repartidores:  RepartidorDisponible[]
  onRefresh?:    () => void
}

// ── Labels ────────────────────────────────────────────────────────────────────

const PRIORIDAD_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: '🔴 Urgente',    color: 'bg-red-50 text-red-700 border-red-200'    },
  2: { label: '🟠 Alta',       color: 'bg-orange-50 text-orange-700 border-orange-200' },
  3: { label: '🟡 Normal',     color: 'bg-amber-50 text-amber-700 border-amber-200'  },
  4: { label: '🟢 Baja',       color: 'bg-green-50 text-green-700 border-green-200'   },
  5: { label: '🔵 Programado', color: 'bg-blue-50 text-blue-700 border-blue-200'    },
}

const ESTADO_COLA: Record<string, { label: string; color: string }> = {
  esperando:  { label: 'Esperando',  color: 'bg-zinc-100 text-zinc-600'    },
  asignado:   { label: 'Asignado',   color: 'bg-sky-50 text-sky-700'       },
  en_ruta:    { label: 'En ruta',    color: 'bg-orange-50 text-orange-700' },
  bloqueado:  { label: 'Bloqueado',  color: 'bg-amber-50 text-amber-700'   },
  reagendado: { label: 'Reagendado', color: 'bg-purple-50 text-purple-700' },
  fallido:    { label: 'Fallido',    color: 'bg-red-50 text-red-700'       },
  cancelado:  { label: 'Cancelado',  color: 'bg-zinc-100 text-zinc-400'    },
  completado: { label: 'Completado', color: 'bg-green-50 text-green-700'   },
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function QueueManager({ items: initialItems, repartidores, onRefresh }: QueueManagerProps) {
  const [items, setItems]         = useState(initialItems)
  const [accionando, setAccionando] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [modalReasignar, setModalReasignar] = useState<QueueItem | null>(null)
  const [modalReagendar, setModalReagendar] = useState<QueueItem | null>(null)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [motivoReagendar, setMotivoReagendar] = useState('')
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState('')

  const itemsActivos = items.filter(i => ['esperando', 'asignado', 'en_ruta', 'bloqueado', 'reagendado'].includes(i.estado))
    .sort((a, b) => b.score - a.score)

  async function cambiarPrioridad(itemId: string, delta: 1 | -1) {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const nuevaPrioridad = Math.min(5, Math.max(1, item.prioridad + delta)) as 1|2|3|4|5

    setAccionando(itemId)
    try {
      const res = await fetch('/api/delivery/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, prioridad: nuevaPrioridad }),
      })
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, prioridad: nuevaPrioridad } : i))
      }
    } catch { /* ignorar */ } finally { setAccionando(null) }
  }

  async function cancelarItem(itemId: string) {
    if (!confirm('¿Cancelar este pedido de la cola?')) return
    setAccionando(itemId)
    try {
      const res = await fetch('/api/delivery/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, estado: 'cancelado' } : i))
      }
    } catch { /* ignorar */ } finally { setAccionando(null) }
  }

  async function reasignar() {
    if (!modalReasignar || !repartidorSeleccionado) return
    setAccionando(modalReasignar.id)
    try {
      const res = await fetch('/api/delivery/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id:    modalReasignar.pedido_id,
          repartidor_id: repartidorSeleccionado,
        }),
      })
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === modalReasignar.id ? { ...i, estado: 'asignado' } : i))
        setModalReasignar(null)
        onRefresh?.()
      } else {
        alert('Error al reasignar')
      }
    } catch { /* ignorar */ } finally {
      setAccionando(null)
      setRepartidorSeleccionado('')
    }
  }

  async function reagendar() {
    if (!modalReagendar || !nuevaFecha) return
    setAccionando(modalReagendar.id)
    try {
      const res = await fetch('/api/delivery/reprogramar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id:  modalReagendar.pedido_id,
          fecha_nueva: nuevaFecha,
          motivo:      motivoReagendar || 'reprogramacion_manual',
          origen:      'dueno',
        }),
      })
      if (res.ok) {
        setItems(prev => prev.map(i =>
          i.id === modalReagendar.id
            ? { ...i, estado: 'reagendado', reagendado_para: nuevaFecha }
            : i
        ))
        setModalReagendar(null)
        setNuevaFecha('')
        setMotivoReagendar('')
      } else {
        alert('Error al reagendar')
      }
    } catch { /* ignorar */ } finally { setAccionando(null) }
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Cola de Delivery</h3>
          <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full font-medium">
            {itemsActivos.length} activos
          </span>
        </div>
        <button onClick={onRefresh} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-50 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista */}
      <div className="divide-y divide-zinc-50 max-h-96 overflow-y-auto">
        {itemsActivos.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">Cola vacía 🎉</p>
          </div>
        ) : (
          itemsActivos.map((item, idx) => {
            const pLabel = PRIORIDAD_LABELS[item.prioridad] ?? PRIORIDAD_LABELS[3]
            const eLabel = ESTADO_COLA[item.estado] ?? ESTADO_COLA.esperando
            const isExpanded = expandido === item.id
            const pedido = item.pedidos

            return (
              <div key={item.id} className="hover:bg-zinc-50 transition">
                {/* Fila principal */}
                <div
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => setExpandido(isExpanded ? null : item.id)}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Número en cola */}
                    <span className="w-5 h-5 bg-zinc-100 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
                      {idx + 1}
                    </span>

                    {/* Info pedido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-zinc-900 truncate">
                          {pedido?.numero_pedido ?? item.pedido_id.slice(0, 8)}
                        </p>
                        <span className={cn('text-[9px] px-1 py-0.5 rounded border font-medium shrink-0', pLabel.color)}>
                          {pLabel.label}
                        </span>
                        <span className={cn('text-[9px] px-1 py-0.5 rounded font-medium shrink-0', eLabel.color)}>
                          {eLabel.label}
                        </span>
                      </div>
                      {pedido && (
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {pedido.nombre_cliente} · {formatPEN(pedido.total)}
                          {item.peso_total_kg ? ` · ${item.peso_total_kg}kg` : ''}
                        </p>
                      )}
                      {item.reagendado_para && (
                        <p className="text-[10px] text-purple-600 mt-0.5 flex items-center gap-1">
                          <CalendarClock className="w-2.5 h-2.5" />
                          {formatFechaHoraLima(item.reagendado_para)}
                        </p>
                      )}
                      {item.bloqueado_hasta && new Date(item.bloqueado_hasta) > new Date() && (
                        <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Libre a las {formatFechaHoraLima(item.bloqueado_hasta)}
                        </p>
                      )}
                      {item.intentos > 0 && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          {item.intentos}/{item.max_intentos} intentos
                        </p>
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-mono text-zinc-400">{item.score}</p>
                    </div>
                  </div>
                </div>

                {/* Acciones expandidas */}
                {isExpanded && (
                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {/* Cambiar prioridad */}
                    {item.estado === 'esperando' && (
                      <>
                        <button
                          onClick={() => cambiarPrioridad(item.id, -1)}
                          disabled={item.prioridad <= 1 || accionando === item.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition disabled:opacity-30"
                        >
                          <ChevronUp className="w-3 h-3" /> Subir prioridad
                        </button>
                        <button
                          onClick={() => cambiarPrioridad(item.id, 1)}
                          disabled={item.prioridad >= 5 || accionando === item.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-100 transition disabled:opacity-30"
                        >
                          <ChevronDown className="w-3 h-3" /> Bajar prioridad
                        </button>
                      </>
                    )}

                    {/* Asignar manualmente */}
                    {item.estado === 'esperando' && repartidores.length > 0 && (
                      <button
                        onClick={() => setModalReasignar(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-sky-50 border border-sky-200 text-sky-700 rounded-lg hover:bg-sky-100 transition"
                      >
                        <CheckCircle className="w-3 h-3" /> Asignar repartidor
                      </button>
                    )}

                    {/* Reagendar */}
                    {['esperando', 'bloqueado', 'fallido'].includes(item.estado) && (
                      <button
                        onClick={() => setModalReagendar(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 transition"
                      >
                        <CalendarClock className="w-3 h-3" /> Reagendar
                      </button>
                    )}

                    {/* Cancelar */}
                    {!['completado', 'cancelado'].includes(item.estado) && (
                      <button
                        onClick={() => cancelarItem(item.id)}
                        disabled={accionando === item.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                      >
                        {accionando === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal: Asignar repartidor */}
      {modalReasignar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl mb-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-zinc-900 text-sm">Asignar repartidor</h3>
              <button onClick={() => setModalReasignar(null)} className="text-zinc-400"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Pedido: <strong>{modalReasignar.pedidos?.numero_pedido}</strong>
            </p>
            <div className="space-y-2 mb-4">
              {repartidores.map(r => (
                <button key={r.id} onClick={() => setRepartidorSeleccionado(r.id)}
                  className={cn('w-full text-left px-3 py-2 rounded-xl text-sm border transition',
                    repartidorSeleccionado === r.id
                      ? 'bg-zinc-900 border-zinc-900 text-white'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  )}>
                  {r.nombre}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalReasignar(null)}
                className="flex-1 py-2.5 text-sm text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={reasignar}
                disabled={!repartidorSeleccionado || accionando !== null}
                className="flex-1 py-2.5 text-sm font-semibold bg-zinc-900 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {accionando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reagendar */}
      {modalReagendar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl mb-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-purple-600" /> Reagendar pedido
              </h3>
              <button onClick={() => { setModalReagendar(null); setNuevaFecha(''); setMotivoReagendar('') }} className="text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Pedido: <strong>{modalReagendar.pedidos?.numero_pedido}</strong>
            </p>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Nueva fecha y hora</label>
            <input
              type="datetime-local"
              value={nuevaFecha}
              onChange={e => setNuevaFecha(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <label className="text-xs font-medium text-zinc-600 block mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={motivoReagendar}
              onChange={e => setMotivoReagendar(e.target.value)}
              placeholder="Ej: Cliente solicitó cambio de hora…"
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="flex gap-2">
              <button onClick={() => { setModalReagendar(null); setNuevaFecha(''); setMotivoReagendar('') }}
                className="flex-1 py-2.5 text-sm text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={reagendar}
                disabled={!nuevaFecha || accionando !== null}
                className="flex-1 py-2.5 text-sm font-semibold bg-purple-600 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {accionando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
