'use client'

/**
 * ColaTab — Pedidos delivery sin repartidor asignado.
 *
 * Features:
 * - Supabase Realtime: se actualiza automáticamente cuando llega un nuevo pedido
 *   o cuando se asigna un repartidor a uno existente.
 * - Integrado con ETA Intelligence: muestra confidence y fuente del ETA.
 * - Quick-assign: dropdown inline para asignar repartidor sin salir de la vista.
 * - Alertas visuales: badge rojo cuando un pedido lleva >15 min sin asignar.
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Clock, MapPin, Package, Truck, AlertTriangle,
  ChevronDown, Loader2, CheckCircle, Users, Zap, Navigation,
} from 'lucide-react'
import { cn, formatPEN } from '@/lib/utils'

interface PrediccionInfo {
  confidence: number
  source: string
  distancia_km: number
}

interface RepartidorDisponible {
  id: string
  nombre: string
  estado: string
  enRuta: boolean
  vehiculo: { id: string; nombre: string; tipo: string; placa: string } | null
}

interface PedidoCola {
  id: string
  numero_pedido: string
  nombre_cliente: string
  telefono_cliente: string
  direccion_entrega: string | null
  cliente_lat: number | null
  cliente_lng: number | null
  total: number
  estado: string
  eta_minutos: number | null
  created_at: string
  minutosEnCola: number
  prediccion: PrediccionInfo | null
  zonas_delivery: { nombre: string } | null
  items_pedido: Array<{ nombre_producto: string; cantidad: number }>
  notas: string | null
}

interface MetricasCola {
  total: number
  maxEsperaMin: number
  avgEsperaMin: number
  conAlerta: number
}

interface ColaData {
  pedidos: PedidoCola[]
  repartidores: RepartidorDisponible[]
  metricas: MetricasCola
}

const TIPO_VEHICULO_ICON: Record<string, string> = {
  moto: '🏍️',
  auto: '🚗',
  bicicleta: '🚲',
}

function ConfidenceDot({ confidence, source }: { confidence: number; source: string }) {
  if (source === 'google') return (
    <span title={`Google Routes · ${Math.round(confidence * 100)}% confianza`}
      className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200">
      IA ●
    </span>
  )
  if (source === 'zone_avg') return (
    <span title={`Historial zona · ${Math.round(confidence * 100)}% confianza`}
      className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200">
      IA ●
    </span>
  )
  return (
    <span title="Estimación base"
      className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-semibold border border-zinc-200">
      ETA
    </span>
  )
}

export default function ColaTab() {
  const [data, setData] = useState<ColaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [asignando, setAsignando] = useState<string | null>(null) // pedidoId en proceso
  const [expandido, setExpandido] = useState<string | null>(null)
  const [seleccionRepartidor, setSeleccionRepartidor] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/cola')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error('[ColaTab] Error fetching:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Supabase Realtime — escuchar cambios en pedidos ──────────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('cola-pedidos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: 'modalidad=eq.delivery',
        },
        () => {
          // Refrescar cuando cualquier pedido delivery cambia
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entregas',
        },
        () => {
          // Refrescar cuando cambia una entrega (asignación de repartidor)
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  async function asignarRepartidor(pedidoId: string) {
    const repartidorId = seleccionRepartidor[pedidoId]
    if (!repartidorId) return

    setAsignando(pedidoId)
    try {
      const res = await fetch(`/api/delivery/cola/${pedidoId}/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repartidor_id: repartidorId }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Error al asignar')
        return
      }
      // Supabase Realtime actualizará la lista automáticamente
    } catch {
      alert('Error de red al asignar')
    } finally {
      setAsignando(null)
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

  const { pedidos, repartidores, metricas } = data
  const repartidoresLibres = repartidores.filter((r) => !r.enRuta)

  return (
    <div className="space-y-4">

      {/* ── Métricas de la cola ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 text-center">
          <p className="text-xs text-zinc-400 mb-1">En cola</p>
          <p className="text-2xl font-bold text-zinc-900">{metricas.total}</p>
          <p className="text-[10px] text-zinc-400">sin asignar</p>
        </div>
        <div className={cn(
          'rounded-2xl border p-4 text-center',
          metricas.conAlerta > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-200'
        )}>
          <p className={cn('text-xs mb-1', metricas.conAlerta > 0 ? 'text-red-500' : 'text-zinc-400')}>Con alerta</p>
          <p className={cn('text-2xl font-bold', metricas.conAlerta > 0 ? 'text-red-600' : 'text-zinc-900')}>
            {metricas.conAlerta}
          </p>
          <p className={cn('text-[10px]', metricas.conAlerta > 0 ? 'text-red-400' : 'text-zinc-400')}>+15 min</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 text-center">
          <p className="text-xs text-zinc-400 mb-1">Espera máx</p>
          <p className="text-2xl font-bold text-zinc-900">{metricas.maxEsperaMin}</p>
          <p className="text-[10px] text-zinc-400">minutos</p>
        </div>
        <div className={cn(
          'rounded-2xl border p-4 text-center',
          repartidoresLibres.length > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        )}>
          <p className={cn('text-xs mb-1', repartidoresLibres.length > 0 ? 'text-green-600' : 'text-amber-600')}>
            Disponibles
          </p>
          <p className={cn('text-2xl font-bold', repartidoresLibres.length > 0 ? 'text-green-700' : 'text-amber-700')}>
            {repartidoresLibres.length}
          </p>
          <p className={cn('text-[10px]', repartidoresLibres.length > 0 ? 'text-green-500' : 'text-amber-500')}>
            repartidores
          </p>
        </div>
      </div>

      {/* ── Banner de repartidores disponibles ──────────────────────────────── */}
      {repartidoresLibres.length > 0 && metricas.total > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Zap className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            <span className="font-semibold">{repartidoresLibres.length} repartidor(es) libre(s)</span>
            {' '}— puedes asignar ahora para reducir el tiempo de espera
          </p>
        </div>
      )}

      {/* ── Lista de pedidos en cola ─────────────────────────────────────────── */}
      {pedidos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-zinc-200">
          <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">Cola vacía</p>
          <p className="text-sm text-zinc-400 mt-1">Todos los pedidos tienen repartidor asignado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => {
            const esUrgente = pedido.minutosEnCola >= 15
            const sinDireccion = !pedido.direccion_entrega?.trim()
            const sinGPS = !pedido.cliente_lat || !pedido.cliente_lng
            const isOpen = expandido === pedido.id
            const repartidorSeleccionado = seleccionRepartidor[pedido.id] ?? ''

            return (
              <div key={pedido.id} className={cn(
                'bg-white rounded-2xl border shadow-sm overflow-hidden',
                esUrgente ? 'border-red-300' : 'border-zinc-200'
              )}>
                {/* Cabecera */}
                <div
                  className="px-4 py-3.5 cursor-pointer"
                  onClick={() => setExpandido(isOpen ? null : pedido.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {/* Indicador de urgencia */}
                      <div className={cn(
                        'w-2.5 h-2.5 rounded-full shrink-0 mt-1',
                        esUrgente ? 'bg-red-500 animate-pulse' : 'bg-amber-400'
                      )} />
                      <div>
                        <p className="font-semibold text-zinc-900 text-sm">{pedido.nombre_cliente}</p>
                        <p className="text-xs text-zinc-400 font-mono">{pedido.numero_pedido}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-zinc-900 text-sm">{formatPEN(pedido.total)}</p>
                      <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform ml-auto mt-0.5', isOpen && 'rotate-180')} />
                    </div>
                  </div>

                  {pedido.direccion_entrega ? (
                    <div className="flex items-center gap-1.5 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <p className="text-xs text-zinc-600 truncate">{pedido.direccion_entrega}</p>
                      {sinGPS && (
                        <span title="Sin coordenadas GPS — ETA no calculable" className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                          sin GPS
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Navigation className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <p className="text-xs text-red-600 font-medium">Sin dirección de entrega</p>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={cn(
                      'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                      esUrgente ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      <Clock className="w-3 h-3" />
                      {pedido.minutosEnCola} min esperando
                    </span>

                    {pedido.eta_minutos && (
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                        <Truck className="w-3 h-3" />
                        ETA ~{pedido.eta_minutos} min
                        {pedido.prediccion && (
                          <ConfidenceDot confidence={pedido.prediccion.confidence} source={pedido.prediccion.source} />
                        )}
                      </span>
                    )}

                    {pedido.zonas_delivery && (
                      <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                        📍 {pedido.zonas_delivery.nombre}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cuerpo expandido */}
                {isOpen && (
                  <div className="border-t border-zinc-100 px-4 py-4 bg-zinc-50 space-y-4">
                    {/* Productos */}
                    <div>
                      <p className="text-xs font-medium text-zinc-500 mb-1.5">
                        {pedido.items_pedido.length} producto(s)
                      </p>
                      <div className="space-y-0.5">
                        {pedido.items_pedido.slice(0, 4).map((item, i) => (
                          <p key={i} className="text-xs text-zinc-600">
                            {item.cantidad}× {item.nombre_producto}
                          </p>
                        ))}
                        {pedido.items_pedido.length > 4 && (
                          <p className="text-xs text-zinc-400">+{pedido.items_pedido.length - 4} más…</p>
                        )}
                      </div>
                    </div>

                    {pedido.notas && (
                      <p className="text-xs text-zinc-500">
                        <span className="font-medium">Notas:</span> {pedido.notas}
                      </p>
                    )}

                    {/* Predicción IA si existe */}
                    {pedido.prediccion && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-700">
                        <span className="font-semibold">Módulo IA:</span>{' '}
                        {pedido.prediccion.source === 'google'
                          ? `Google Routes · ${pedido.prediccion.distancia_km?.toFixed(1)} km`
                          : pedido.prediccion.source === 'zone_avg'
                          ? 'Historial de zona'
                          : 'Estimación Haversine'
                        }
                        {' · '}
                        {Math.round(pedido.prediccion.confidence * 100)}% confianza
                      </div>
                    )}

                    {/* ── Alertas de datos incompletos ── */}
                    {sinDireccion && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-700">Sin dirección de entrega</p>
                          <p className="text-[11px] text-red-600 mt-0.5">El repartidor no sabrá a dónde ir. Contacta al cliente antes de asignar.</p>
                        </div>
                      </div>
                    )}
                    {!sinDireccion && sinGPS && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                        <Navigation className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700">Sin GPS — el ETA no se puede calcular con precisión. Haversine como fallback.</p>
                      </div>
                    )}

                    {/* ── Asignación de repartidor ── */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Asignar repartidor
                      </p>
                      <select
                        value={repartidorSeleccionado}
                        onChange={(e) =>
                          setSeleccionRepartidor((prev) => ({ ...prev, [pedido.id]: e.target.value }))
                        }
                        className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
                      >
                        <option value="">— Seleccionar repartidor —</option>
                        {repartidores.map((r) => (
                          <option key={r.id} value={r.id} disabled={r.enRuta}>
                            {r.enRuta ? '🚴 En ruta · ' : '✅ Libre · '}{r.nombre}
                            {r.vehiculo ? ` (${TIPO_VEHICULO_ICON[r.vehiculo.tipo] ?? '🚛'} ${r.vehiculo.nombre})` : ''}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => asignarRepartidor(pedido.id)}
                        disabled={!repartidorSeleccionado || asignando === pedido.id}
                        className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
                      >
                        {asignando === pedido.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Asignar y notificar al cliente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
