'use client'

/**
 * OperationsLog — Log de operaciones del sistema de delivery
 *
 * Muestra los eventos recientes de delivery_operaciones_log
 * con filtros por tipo y botón para marcar como resuelto.
 */

import { useState } from 'react'
import { CheckCircle, Loader2, RefreshCw, AlertTriangle, Truck, User, Package } from 'lucide-react'
import { cn, formatFechaHoraLima } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OperacionLog {
  id:          string
  tipo_evento: string
  entidad_tipo: string | null
  entidad_id:  string | null
  detalle:     Record<string, unknown> | null
  origen:      string | null
  resuelto:    boolean
  created_at:  string
}

interface OperationsLogProps {
  logs:       OperacionLog[]
  onRefresh?: () => void
}

// ── Config de eventos ─────────────────────────────────────────────────────────

const EVENTO_CONFIG: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  vehiculo_averia_leve:     { label: 'Avería leve',       icon: '🔧', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  vehiculo_averia_grave:    { label: 'Avería grave',      icon: '🚨', color: 'text-red-700',   bgColor: 'bg-red-50 border-red-200'     },
  repartidor_emergencia:    { label: 'Emergencia',        icon: '🚨', color: 'text-red-700',   bgColor: 'bg-red-50 border-red-200'     },
  repartidor_no_disponible: { label: 'No disponible',     icon: '⚠️', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  cliente_ausente:          { label: 'Cliente ausente',   icon: '🚪', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  reasignacion_propuesta:   { label: 'Reasignación',      icon: '🔄', color: 'text-sky-700',   bgColor: 'bg-sky-50 border-sky-200'     },
  reasignacion_ejecutada:   { label: 'Reasignado',        icon: '✅', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  entrega_fallida:          { label: 'Fallo de entrega',  icon: '❌', color: 'text-red-700',   bgColor: 'bg-red-50 border-red-200'     },
  pedido_cancelado:         { label: 'Pedido cancelado',  icon: '🗑',  color: 'text-zinc-700',  bgColor: 'bg-zinc-50 border-zinc-200'   },
  sin_repartidor:           { label: 'Sin repartidor',    icon: '⚠️', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  entrega_demorada:         { label: 'Demora detectada',  icon: '⏱',  color: 'text-orange-700',bgColor: 'bg-orange-50 border-orange-200'},
  gps_desactualizado:       { label: 'GPS perdido',       icon: '📡', color: 'text-zinc-600',  bgColor: 'bg-zinc-50 border-zinc-200'   },
  programado_sin_repartidor:{ label: 'Programado s/repartidor', icon: '📅', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  cola_sin_repartidores:    { label: 'Cola sin repartidores', icon: '🚨', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function OperationsLog({ logs: initialLogs, onRefresh }: OperationsLogProps) {
  const [logs, setLogs]         = useState(initialLogs)
  const [filtro, setFiltro]     = useState<'todos' | 'activos' | 'criticos'>('activos')
  const [resolviendo, setResolviendo] = useState<string | null>(null)

  const logsFiltrados = logs.filter(log => {
    if (filtro === 'activos')  return !log.resuelto
    if (filtro === 'criticos') return !log.resuelto && ['vehiculo_averia_grave', 'repartidor_emergencia', 'cola_sin_repartidores', 'programado_sin_repartidor'].includes(log.tipo_evento)
    return true
  })

  async function marcarResuelto(logId: string) {
    setResolviendo(logId)
    try {
      const res = await fetch(`/api/delivery/operations/${logId}/resolve`, {
        method: 'PATCH',
      })
      if (res.ok) {
        setLogs(prev => prev.map(l => l.id === logId ? { ...l, resuelto: true } : l))
      }
    } catch { /* ignorar */ } finally {
      setResolviendo(null)
    }
  }

  const totalNoResueltos = logs.filter(l => !l.resuelto).length

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900">Log de Operaciones</h3>
          {totalNoResueltos > 0 && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold border border-red-200">
              {totalNoResueltos} activos
            </span>
          )}
        </div>
        <button onClick={onRefresh} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-50 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex border-b border-zinc-100">
        {([
          { id: 'activos',  label: 'Activos'  },
          { id: 'criticos', label: 'Críticos' },
          { id: 'todos',    label: 'Todos'    },
        ] as const).map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={cn('flex-1 py-2 text-xs font-medium transition',
              filtro === f.id ? 'border-b-2 border-orange-500 text-orange-700' : 'text-zinc-400 hover:text-zinc-600'
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="divide-y divide-zinc-50 max-h-96 overflow-y-auto">
        {logsFiltrados.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">
              {filtro === 'activos' ? 'Sin alertas activas 🎉' : 'Sin registros'}
            </p>
          </div>
        ) : (
          logsFiltrados.slice(0, 30).map(log => {
            const config = EVENTO_CONFIG[log.tipo_evento] ?? {
              label:   log.tipo_evento,
              icon:    '•',
              color:   'text-zinc-600',
              bgColor: 'bg-zinc-50 border-zinc-200',
            }

            const detalle = (log.detalle ?? {}) as {
              mensaje?:              string
              descripcion?:          string
              entregas_afectadas?:   number
              entregas_reasignadas?: number
              requiere_aprobacion?:  boolean
            }

            return (
              <div key={log.id} className={cn(
                'px-4 py-3 transition',
                log.resuelto ? 'opacity-40' : 'hover:bg-zinc-50'
              )}>
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-xs font-semibold', config.color)}>{config.label}</span>
                      <span className="text-[10px] text-zinc-400 shrink-0">
                        {formatFechaHoraLima(log.created_at)}
                      </span>
                    </div>

                    {/* Detalle contextual */}
                    <div className="mt-0.5 space-y-0.5">
                      {detalle.mensaje && (
                        <p className="text-[11px] text-zinc-600">{detalle.mensaje as string}</p>
                      )}
                      {detalle.descripcion && (
                        <p className="text-[11px] text-zinc-600">{detalle.descripcion as string}</p>
                      )}
                      {detalle.entregas_afectadas != null && (
                        <p className="text-[11px] text-zinc-500">
                          📦 {detalle.entregas_afectadas as number} entrega(s) afectada(s)
                        </p>
                      )}
                      {detalle.entregas_reasignadas != null && (detalle.entregas_reasignadas as number) > 0 && (
                        <p className="text-[11px] text-green-600">
                          ✓ {detalle.entregas_reasignadas as number} reasignada(s)
                        </p>
                      )}
                      {detalle.requiere_aprobacion && (
                        <p className="text-[11px] text-amber-600 font-medium">
                          ⚠ Requiere aprobación manual
                        </p>
                      )}
                    </div>

                    {/* Origen */}
                    {log.origen && (
                      <p className="text-[10px] text-zinc-300 mt-1">
                        vía {log.origen}
                      </p>
                    )}
                  </div>

                  {/* Acción resolver */}
                  {!log.resuelto && (
                    <button
                      onClick={() => marcarResuelto(log.id)}
                      disabled={resolviendo === log.id}
                      title="Marcar como resuelto"
                      className="shrink-0 p-1.5 bg-zinc-100 hover:bg-green-100 text-zinc-400 hover:text-green-600 rounded-lg transition"
                    >
                      {resolviendo === log.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <CheckCircle className="w-3 h-3" />
                      }
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
