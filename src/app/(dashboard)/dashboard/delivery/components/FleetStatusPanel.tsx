'use client'

/**
 * FleetStatusPanel — Panel de estado de flota en tiempo real
 *
 * Muestra:
 *   - Estado de cada vehículo (disponible / en_uso / avería)
 *   - Estado de cada repartidor (disponible / en_ruta / emergencia / etc.)
 *   - Acciones rápidas: cambiar estado, reasignar, escalar
 */

import { useState } from 'react'
import { Truck, User, Wrench, AlertTriangle, CheckCircle, RefreshCw, Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VehiculoFlota {
  id:                string
  nombre:            string
  tipo:              string
  placa:             string | null
  estado:            string
  descripcion_averia: string | null
  est_resolucion_at: string | null
  repartidor?:       { nombre: string } | null
}

interface RepartidorFlota {
  id:               string
  nombre:           string
  estado_operativo: string
  ultima_lat:       number | null
  ultima_lng:       number | null
  gps_actualizado_at: string | null
  vehiculo?:        { nombre: string; tipo: string } | null
  entregasActivas:  number
}

interface FleetStatusPanelProps {
  vehiculos:    VehiculoFlota[]
  repartidores: RepartidorFlota[]
  onRefresh?:   () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_VEHICULO: Record<string, { label: string; color: string; dot: string }> = {
  disponible:    { label: 'Disponible',    color: 'bg-green-50 text-green-700',   dot: 'bg-green-400'  },
  en_uso:        { label: 'En uso',        color: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-400'   },
  averia_leve:   { label: 'Avería leve',   color: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-400'  },
  averia_grave:  { label: 'Avería grave',  color: 'bg-red-50 text-red-700',       dot: 'bg-red-500'    },
  mantenimiento: { label: 'Mantenimiento', color: 'bg-zinc-100 text-zinc-600',    dot: 'bg-zinc-400'   },
  fuera_servicio:{ label: 'Fuera servicio',color: 'bg-zinc-200 text-zinc-500',    dot: 'bg-zinc-400'   },
}

const ESTADO_REPARTIDOR: Record<string, { label: string; color: string; dot: string }> = {
  disponible:    { label: 'Disponible',    color: 'bg-green-50 text-green-700',   dot: 'bg-green-400'  },
  en_ruta:       { label: 'En ruta',       color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400 animate-pulse' },
  entre_paradas: { label: 'Entre paradas', color: 'bg-sky-50 text-sky-700',       dot: 'bg-sky-400'    },
  pausa:         { label: 'En pausa',      color: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-400'  },
  averia:        { label: 'Avería',        color: 'bg-red-50 text-red-700',       dot: 'bg-red-500'    },
  emergencia:    { label: 'EMERGENCIA',    color: 'bg-red-100 text-red-800 font-bold', dot: 'bg-red-600 animate-ping' },
  fuera_turno:   { label: 'Fuera turno',   color: 'bg-zinc-100 text-zinc-500',    dot: 'bg-zinc-300'   },
  no_disponible: { label: 'No disponible', color: 'bg-zinc-100 text-zinc-500',    dot: 'bg-zinc-300'   },
}

const ICONO_TIPO: Record<string, string> = {
  moto:      '🏍',
  auto:      '🚗',
  bicicleta: '🚲',
  camion:    '🚛',
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function FleetStatusPanel({ vehiculos, repartidores, onRefresh }: FleetStatusPanelProps) {
  const [tab, setTab]           = useState<'vehiculos' | 'repartidores'>('repartidores')
  const [accionando, setAccionando] = useState<string | null>(null)
  const [, forceUpdate]         = useState(0)

  const vehiculosConProblema = vehiculos.filter(v =>
    ['averia_leve', 'averia_grave', 'mantenimiento'].includes(v.estado)
  ).length

  const repartidoresEmergencia = repartidores.filter(r =>
    r.estado_operativo === 'emergencia'
  ).length

  const repartidoresActivos = repartidores.filter(r =>
    ['disponible', 'en_ruta', 'entre_paradas', 'pausa'].includes(r.estado_operativo)
  ).length

  async function cambiarEstadoVehiculo(vehiculoId: string, nuevoEstado: string) {
    setAccionando(vehiculoId)
    try {
      await fetch(`/api/delivery/vehicles/${vehiculoId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      onRefresh?.()
    } catch {
      alert('Error al cambiar estado del vehículo')
    } finally {
      setAccionando(null)
    }
  }

  async function cambiarEstadoRepartidor(repartidorId: string, nuevoEstado: string) {
    setAccionando(repartidorId)
    try {
      await fetch(`/api/delivery/drivers/${repartidorId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_operativo: nuevoEstado }),
      })
      forceUpdate(n => n + 1)
      onRefresh?.()
    } catch {
      alert('Error al cambiar estado del repartidor')
    } finally {
      setAccionando(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Estado de Flota</h3>
          {(vehiculosConProblema > 0 || repartidoresEmergencia > 0) && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold border border-red-200">
              ⚠ {vehiculosConProblema + repartidoresEmergencia} alertas
            </span>
          )}
        </div>
        <button onClick={onRefresh} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-50 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-px bg-zinc-100 border-b border-zinc-100">
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-lg font-bold text-green-600">{repartidores.filter(r => r.estado_operativo === 'disponible').length}</p>
          <p className="text-[10px] text-zinc-400">Disponibles</p>
        </div>
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-lg font-bold text-orange-600">{repartidores.filter(r => r.estado_operativo === 'en_ruta').length}</p>
          <p className="text-[10px] text-zinc-400">En ruta</p>
        </div>
        <div className="bg-white px-3 py-2 text-center">
          <p className={cn('text-lg font-bold', repartidoresEmergencia > 0 ? 'text-red-600' : 'text-zinc-400')}>
            {repartidoresEmergencia + vehiculosConProblema}
          </p>
          <p className="text-[10px] text-zinc-400">Alertas</p>
        </div>
      </div>

      {/* Tabs internas */}
      <div className="flex border-b border-zinc-100">
        {([
          { id: 'repartidores', label: `Repartidores (${repartidoresActivos}/${repartidores.length})` },
          { id: 'vehiculos', label: `Vehículos (${vehiculos.filter(v => v.estado === 'disponible').length}/${vehiculos.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex-1 py-2 text-xs font-medium transition',
              tab === t.id ? 'border-b-2 border-orange-500 text-orange-700' : 'text-zinc-400 hover:text-zinc-600'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="divide-y divide-zinc-50 max-h-80 overflow-y-auto">
        {tab === 'repartidores' && repartidores.map(rep => {
          const estado = ESTADO_REPARTIDOR[rep.estado_operativo] ?? ESTADO_REPARTIDOR.no_disponible
          const gpsAntiguo = rep.gps_actualizado_at
            ? (Date.now() - new Date(rep.gps_actualizado_at).getTime()) > 30 * 60_000
            : false

          return (
            <div key={rep.id} className="px-4 py-3 hover:bg-zinc-50 transition">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 bg-zinc-100 rounded-full flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', estado.dot)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{rep.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', estado.color)}>
                        {estado.label}
                      </span>
                      {rep.entregasActivas > 0 && (
                        <span className="text-[10px] text-zinc-400">{rep.entregasActivas} entrega{rep.entregasActivas > 1 ? 's' : ''}</span>
                      )}
                      {rep.vehiculo && (
                        <span className="text-[10px] text-zinc-400">
                          {ICONO_TIPO[rep.vehiculo.tipo] ?? '🚗'} {rep.vehiculo.nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {gpsAntiguo && rep.estado_operativo === 'en_ruta' && (
                    <span title="GPS desactualizado >30 min">
                      <MapPin className="w-3 h-3 text-amber-400" />
                    </span>
                  )}
                  {rep.estado_operativo === 'emergencia' && (
                    <button
                      onClick={() => cambiarEstadoRepartidor(rep.id, 'disponible')}
                      disabled={accionando === rep.id}
                      title="Marcar como disponible"
                      className="p-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                    >
                      {accionando === rep.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    </button>
                  )}
                  {['averia', 'no_disponible'].includes(rep.estado_operativo) && (
                    <button
                      onClick={() => cambiarEstadoRepartidor(rep.id, 'disponible')}
                      disabled={accionando === rep.id}
                      title="Marcar como disponible"
                      className="p-1 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition"
                    >
                      {accionando === rep.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {tab === 'vehiculos' && vehiculos.map(v => {
          const estado = ESTADO_VEHICULO[v.estado] ?? ESTADO_VEHICULO.disponible

          return (
            <div key={v.id} className="px-4 py-3 hover:bg-zinc-50 transition">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{ICONO_TIPO[v.tipo] ?? '🚗'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">
                      {v.nombre}
                      {v.placa && <span className="text-zinc-400 font-normal"> · {v.placa}</span>}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', estado.color)}>
                        {estado.label}
                      </span>
                    </div>
                    {v.descripcion_averia && (
                      <p className="text-[10px] text-red-600 mt-0.5 truncate flex items-center gap-1">
                        <Wrench className="w-2.5 h-2.5 shrink-0" /> {v.descripcion_averia}
                      </p>
                    )}
                    {v.repartidor && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">Asignado a: {v.repartidor.nombre}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {['averia_leve', 'averia_grave', 'mantenimiento'].includes(v.estado) && (
                    <>
                      <button
                        onClick={() => cambiarEstadoVehiculo(v.id, 'disponible')}
                        disabled={accionando === v.id}
                        title="Marcar como disponible (reparado)"
                        className="p-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                      >
                        {accionando === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      </button>
                    </>
                  )}
                  {v.estado === 'disponible' && (
                    <button
                      onClick={() => cambiarEstadoVehiculo(v.id, 'mantenimiento')}
                      disabled={accionando === v.id}
                      title="Enviar a mantenimiento"
                      className="p-1 bg-zinc-100 text-zinc-500 rounded-lg hover:bg-zinc-200 transition"
                    >
                      {accionando === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {tab === 'repartidores' && repartidores.length === 0 && (
          <div className="py-8 text-center text-xs text-zinc-400">
            <User className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
            No hay repartidores configurados
          </div>
        )}
        {tab === 'vehiculos' && vehiculos.length === 0 && (
          <div className="py-8 text-center text-xs text-zinc-400">
            <Truck className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
            No hay vehículos configurados
          </div>
        )}
      </div>
    </div>
  )
}
