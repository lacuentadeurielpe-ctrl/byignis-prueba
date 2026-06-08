'use client'

/**
 * IncidenciasTab — Bandeja de incidencias reportadas por repartidores.
 *
 * Features:
 * - Supabase Realtime: nueva incidencia aparece inmediatamente sin recargar.
 * - Urgencia visual: incidencias con ETA vencido o >30 min sin resolver → rojo.
 * - Acciones del dueño: Resolver / Reasignar / Cancelar pedido.
 * - Integrado con ETA Intelligence: muestra si el ETA ya fue superado.
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AlertTriangle, Clock, MapPin, CheckCircle,
  RotateCcw, X, Loader2, Users, Package,
} from 'lucide-react'
import { cn, formatPEN } from '@/lib/utils'

interface IncidenciaItem {
  id: string
  numero_pedido: string
  nombre_cliente: string
  telefono_cliente: string
  direccion_entrega: string | null
  total: number
  estado: string
  estado_pago: string
  incidencia_tipo: string
  incidencia_desc: string | null
  eta_minutos: number | null
  created_at: string
  minutosDesdeCreacion: number
  etaYaSurio: boolean
  repartidorNombre: string | null
  entregaEstado: string | null
  entregaId: string | null
  zonas_delivery: { nombre: string } | null
  items_pedido: Array<{ nombre_producto: string; cantidad: number }>
}

interface IncidenciasData {
  incidencias: IncidenciaItem[]
  urgentes: number
  normales: number
  total: number
}

const TIPO_INCIDENCIA: Record<string, { label: string; emoji: string; color: string }> = {
  cliente_ausente:   { label: 'Cliente no estaba',  emoji: '🚪', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  pedido_incorrecto: { label: 'Pedido incorrecto',  emoji: '📦', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  pago_rechazado:    { label: 'No pudo pagar',      emoji: '💳', color: 'text-red-700 bg-red-50 border-red-200' },
  otro:              { label: 'Otro problema',      emoji: '⚠️', color: 'text-zinc-700 bg-zinc-100 border-zinc-200' },
}

type AccionModal = 'resolver' | 'reasignar' | 'cancelar'

export default function IncidenciasTab() {
  const [data, setData] = useState<IncidenciasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [modal, setModal] = useState<{ pedidoId: string; accion: AccionModal } | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [nuevoRepartidorId, setNuevoRepartidorId] = useState('')
  const [repartidores, setRepartidores] = useState<Array<{ id: string; nombre: string }>>([])

  const fetchData = useCallback(async () => {
    try {
      const [incRes, colaRes] = await Promise.all([
        fetch('/api/delivery/incidencias'),
        fetch('/api/delivery/cola'),
      ])
      if (incRes.ok) {
        const json = await incRes.json()
        setData(json)
      }
      if (colaRes.ok) {
        const json = await colaRes.json()
        setRepartidores(json.repartidores ?? [])
      }
    } catch (e) {
      console.error('[IncidenciasTab] Error fetching:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Supabase Realtime ────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('incidencias-pedidos')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
      }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  async function ejecutarAccion() {
    if (!modal) return
    setProcesando(true)
    try {
      const body: Record<string, unknown> = { accion: modal.accion }
      if (modal.accion === 'reasignar') {
        if (!nuevoRepartidorId) { alert('Selecciona un repartidor'); return }
        body.nuevo_repartidor_id = nuevoRepartidorId
      }

      const res = await fetch(`/api/delivery/incidencias/${modal.pedidoId}/resolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Error al procesar')
        return
      }
      setModal(null)
      // Supabase Realtime actualizará la lista
    } catch {
      alert('Error de red')
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4">

      {/* ── Métricas ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn(
          'rounded-2xl border p-4 text-center',
          data.urgentes > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-200'
        )}>
          <p className={cn('text-xs mb-1', data.urgentes > 0 ? 'text-red-500' : 'text-zinc-400')}>Urgentes</p>
          <p className={cn('text-2xl font-bold', data.urgentes > 0 ? 'text-red-600' : 'text-zinc-900')}>
            {data.urgentes}
          </p>
          <p className={cn('text-[10px]', data.urgentes > 0 ? 'text-red-400' : 'text-zinc-400')}>ETA vencido</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 text-center">
          <p className="text-xs text-zinc-400 mb-1">Normales</p>
          <p className="text-2xl font-bold text-zinc-900">{data.normales}</p>
          <p className="text-[10px] text-zinc-400">sin resolver</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 text-center">
          <p className="text-xs text-zinc-400 mb-1">Total activas</p>
          <p className="text-2xl font-bold text-zinc-900">{data.total}</p>
          <p className="text-[10px] text-zinc-400">incidencias</p>
        </div>
      </div>

      {/* ── Lista ──────────────────────────────────────────────────────────────── */}
      {data.incidencias.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-zinc-200">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">Sin incidencias activas</p>
          <p className="text-sm text-zinc-400 mt-1">Todo funciona correctamente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.incidencias.map((inc) => {
            const tipoInfo = TIPO_INCIDENCIA[inc.incidencia_tipo] ?? TIPO_INCIDENCIA.otro
            const isOpen = expandido === inc.id

            return (
              <div key={inc.id} className={cn(
                'bg-white rounded-2xl border shadow-sm overflow-hidden',
                inc.etaYaSurio || inc.minutosDesdeCreacion > 30
                  ? 'border-red-300'
                  : 'border-amber-300'
              )}>
                {/* Cabecera */}
                <div
                  className="px-4 py-3.5 cursor-pointer"
                  onClick={() => setExpandido(isOpen ? null : inc.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', tipoInfo.color)}>
                          {tipoInfo.emoji} {tipoInfo.label}
                        </span>
                        {inc.etaYaSurio && (
                          <span className="text-[10px] bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-semibold">
                            ETA vencido
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-zinc-900 text-sm mt-1">{inc.nombre_cliente}</p>
                      <p className="text-xs text-zinc-400 font-mono">{inc.numero_pedido}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-zinc-900 text-sm">{formatPEN(inc.total)}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        hace {inc.minutosDesdeCreacion} min
                      </p>
                    </div>
                  </div>

                  {/* Info adicional */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {inc.repartidorNombre && (
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <Users className="w-3 h-3" />
                        {inc.repartidorNombre}
                      </span>
                    )}
                    {inc.direccion_entrega && (
                      <span className="flex items-center gap-1 text-xs text-zinc-500 truncate max-w-[180px]">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {inc.direccion_entrega}
                      </span>
                    )}
                    {inc.eta_minutos && (
                      <span className="flex items-center gap-1 text-xs text-sky-600">
                        <Clock className="w-3 h-3" />
                        ETA orig: {inc.eta_minutos} min
                      </span>
                    )}
                  </div>

                  {inc.incidencia_desc && (
                    <p className="mt-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg px-2.5 py-1.5">
                      {inc.incidencia_desc}
                    </p>
                  )}
                </div>

                {/* Cuerpo expandido */}
                {isOpen && (
                  <div className="border-t border-zinc-100 px-4 py-4 bg-zinc-50 space-y-3">
                    {/* Productos */}
                    <div>
                      <p className="text-xs font-medium text-zinc-500 mb-1">Productos</p>
                      {inc.items_pedido.slice(0, 3).map((item, i) => (
                        <p key={i} className="text-xs text-zinc-600">{item.cantidad}× {item.nombre_producto}</p>
                      ))}
                    </div>

                    {/* Acciones */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setModal({ pedidoId: inc.id, accion: 'resolver' })}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Resolver
                      </button>
                      <button
                        onClick={() => { setNuevoRepartidorId(''); setModal({ pedidoId: inc.id, accion: 'reasignar' }) }}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reasignar
                      </button>
                      <button
                        onClick={() => setModal({ pedidoId: inc.id, accion: 'cancelar' })}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal de confirmación ──────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl mb-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-900">
                {modal.accion === 'resolver' && '✅ Resolver incidencia'}
                {modal.accion === 'reasignar' && '🔄 Reasignar a otro repartidor'}
                {modal.accion === 'cancelar' && '❌ Cancelar pedido'}
              </h3>
              <button onClick={() => setModal(null)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>

            {modal.accion === 'resolver' && (
              <p className="text-sm text-zinc-600">
                Se marcará la incidencia como resuelta y el pedido quedará listo para re-enviarse.
              </p>
            )}

            {modal.accion === 'reasignar' && (
              <div className="space-y-2">
                <p className="text-sm text-zinc-600">Selecciona el nuevo repartidor:</p>
                <select
                  value={nuevoRepartidorId}
                  onChange={(e) => setNuevoRepartidorId(e.target.value)}
                  className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="">— Seleccionar —</option>
                  {repartidores.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.enRuta ? '🚴 En ruta · ' : '✅ Libre · '}{r.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modal.accion === 'cancelar' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
                ⚠️ El pedido será cancelado. Se liberará la posición en la cola y se recalcularán los ETAs.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 text-sm text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarAccion}
                disabled={procesando || (modal.accion === 'reasignar' && !nuevoRepartidorId)}
                className={cn(
                  'flex-1 py-2.5 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50',
                  modal.accion === 'cancelar'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : modal.accion === 'reasignar'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                )}
              >
                {procesando && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
