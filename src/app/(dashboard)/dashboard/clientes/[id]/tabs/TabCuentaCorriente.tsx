'use client'

import { useState } from 'react'
import { formatPEN, formatFecha, cn } from '@/lib/utils'
import {
  Wallet, Calendar, CheckCircle2, AlertCircle, ChevronDown,
  Plus, Loader2, X, Clock, AlertTriangle,
} from 'lucide-react'

interface AbonoCredito {
  id: string
  monto: number
  metodo_pago: string | null
  notas: string | null
  created_at: string
}

interface Deuda {
  id: string
  monto_total: number
  monto_pagado: number
  fecha_limite: string
  estado: string
  created_at: string
  notas?: string | null
  pedidos?: { numero_pedido: string } | null
  abonos_credito?: AbonoCredito[]
}

interface Props {
  creditos: Deuda[]
  clienteId: string
  esDueno: boolean
  onDeudaUpdate?: (nuevoSaldoTotal: number) => void
}

const METODO_LABEL: Record<string, string> = {
  efectivo:      '💵 Efectivo',
  yape:          '📱 Yape',
  transferencia: '🏦 Transferencia',
  tarjeta:       '💳 Tarjeta',
}

function diasRestantes(fechaLimite: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limite = new Date(fechaLimite + 'T00:00:00')
  return Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function badgeEstado(deuda: Deuda) {
  if (deuda.estado === 'pagado') {
    return { label: 'Pagado', color: 'bg-green-100 text-green-700', Icon: CheckCircle2 }
  }
  if (deuda.estado === 'vencido') {
    return { label: 'Vencido', color: 'bg-red-100 text-red-700', Icon: AlertTriangle }
  }
  const dias = diasRestantes(deuda.fecha_limite)
  if (dias <= 3)  return { label: `Vence en ${dias}d`, color: 'bg-red-100 text-red-700',   Icon: AlertTriangle }
  if (dias <= 7)  return { label: `Vence en ${dias}d`, color: 'bg-amber-100 text-amber-700', Icon: Clock }
  return           { label: `Vence en ${dias}d`, color: 'bg-blue-100 text-blue-700',    Icon: Clock }
}

export default function TabCuentaCorriente({ creditos: inicial, clienteId, esDueno, onDeudaUpdate }: Props) {
  const [deudas, setDeudas] = useState<Deuda[]>(inicial)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'' | 'activo' | 'vencido' | 'pagado'>('')
  const [abonoDialog, setAbonoDialog] = useState<{
    deudaId: string
    monto: string
    metodo: string
    notas: string
  } | null>(null)
  const [registrando, setRegistrando] = useState(false)

  const deudaTotal = deudas
    .filter(d => d.estado !== 'pagado')
    .reduce((s, d) => s + Math.max(0, d.monto_total - d.monto_pagado), 0)

  const filtradas = filtro ? deudas.filter(d => d.estado === filtro) : deudas

  async function registrarAbono() {
    if (!abonoDialog) return
    const monto = Number(abonoDialog.monto)
    if (!monto || monto <= 0) return alert('Ingresa un monto válido')

    setRegistrando(true)
    try {
      const res = await fetch(`/api/creditos/${abonoDialog.deudaId}/abonar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto,
          metodo_pago: abonoDialog.metodo || null,
          notas: abonoDialog.notas || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error al registrar pago')
      }
      const data = await res.json()

      // Optimistic update: actualizar deuda localmente
      const nuevasDeudas = deudas.map(d => {
        if (d.id !== abonoDialog.deudaId) return d
        return {
          ...d,
          monto_pagado: data.nuevo_monto_pagado,
          estado: data.nuevo_estado,
          abonos_credito: [
            ...(d.abonos_credito ?? []),
            data.abono,
          ],
        }
      })
      setDeudas(nuevasDeudas)

      // Notificar al padre (actualiza KPI del header del cliente)
      const nuevoSaldo = nuevasDeudas
        .filter(d => d.estado !== 'pagado')
        .reduce((s, d) => s + Math.max(0, d.monto_total - d.monto_pagado), 0)
      onDeudaUpdate?.(nuevoSaldo)

      setAbonoDialog(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al registrar pago')
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumen KPI */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
            deudaTotal > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          )}>
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Saldo deudor total</p>
            <p className={cn('text-2xl font-bold', deudaTotal > 0 ? 'text-rose-600' : 'text-emerald-600')}>
              {formatPEN(deudaTotal)}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-zinc-400">
          <p>{deudas.filter(d => d.estado === 'activo').length} activa{deudas.filter(d => d.estado === 'activo').length !== 1 ? 's' : ''}</p>
          {deudas.filter(d => d.estado === 'vencido').length > 0 && (
            <p className="text-red-500 font-semibold">{deudas.filter(d => d.estado === 'vencido').length} vencida{deudas.filter(d => d.estado === 'vencido').length !== 1 ? 's' : ''} ⚠️</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      {deudas.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(['', 'activo', 'vencido', 'pagado'] as const).map(e => (
            <button
              key={e}
              onClick={() => setFiltro(e)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition',
                filtro === e ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {e === ''       ? `Todas (${deudas.length})`
               : e === 'activo'  ? `Activas (${deudas.filter(d => d.estado === 'activo').length})`
               : e === 'vencido' ? `Vencidas (${deudas.filter(d => d.estado === 'vencido').length})`
               : `Pagadas (${deudas.filter(d => d.estado === 'pagado').length})`}
            </button>
          ))}
        </div>
      )}

      {/* Lista de deudas */}
      <div>
        <h3 className="text-sm font-bold text-zinc-900 mb-3">Deudas del cliente</h3>

        {filtradas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-zinc-200" />
            <p className="text-sm text-zinc-500">
              {filtro ? `No hay deudas con estado "${filtro}"` : 'El cliente no tiene deudas registradas.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map(deuda => {
              const saldo      = deuda.monto_total - deuda.monto_pagado
              const porcentaje = deuda.monto_total > 0 ? (deuda.monto_pagado / deuda.monto_total) * 100 : 0
              const badge      = badgeEstado(deuda)
              const BadgeIcon  = badge.Icon
              const abierto    = expandido === deuda.id

              return (
                <div key={deuda.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                  {/* Cabecera clickeable */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 transition"
                    onClick={() => setExpandido(abierto ? null : deuda.id)}
                  >
                    <ChevronDown className={cn(
                      'w-4 h-4 text-zinc-400 shrink-0 transition-transform',
                      abierto && 'rotate-180'
                    )} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-900">
                          {formatPEN(deuda.monto_total)}
                        </p>
                        {deuda.pedidos?.numero_pedido && (
                          <span className="text-xs font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded-md">
                            {deuda.pedidos.numero_pedido}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Creada {formatFecha(deuda.created_at)}
                        {' · '}
                        vence {new Date(deuda.fecha_limite + 'T00:00:00').toLocaleDateString('es-PE')}
                      </p>
                    </div>

                    {/* Barra de progreso */}
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-28">
                      <div className="w-full bg-zinc-100 rounded-full h-1.5">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            deuda.estado === 'pagado' ? 'bg-green-500' : 'bg-orange-400'
                          )}
                          style={{ width: `${Math.min(100, porcentaje)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {formatPEN(deuda.monto_pagado)} / {formatPEN(deuda.monto_total)}
                      </p>
                    </div>

                    <span className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0', badge.color)}>
                      <BadgeIcon className="w-3 h-3" />
                      {badge.label}
                    </span>
                  </div>

                  {/* Detalle expandible */}
                  {abierto && (
                    <div className="border-t border-zinc-100 px-4 py-3 bg-zinc-50 space-y-3">
                      {/* Resumen montos */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-lg p-2">
                          <p className="text-xs text-zinc-400">Total</p>
                          <p className="text-sm font-bold text-zinc-800">{formatPEN(deuda.monto_total)}</p>
                        </div>
                        <div className="bg-white rounded-lg p-2">
                          <p className="text-xs text-zinc-400">Pagado</p>
                          <p className="text-sm font-bold text-green-700">{formatPEN(deuda.monto_pagado)}</p>
                        </div>
                        <div className="bg-white rounded-lg p-2">
                          <p className="text-xs text-zinc-400">Saldo</p>
                          <p className={cn('text-sm font-bold', saldo > 0 ? 'text-red-600' : 'text-zinc-400')}>
                            {formatPEN(saldo)}
                          </p>
                        </div>
                      </div>

                      {/* Historial de pagos */}
                      {(deuda.abonos_credito?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-zinc-500 mb-1.5">Historial de pagos</p>
                          <div className="space-y-1.5">
                            {[...(deuda.abonos_credito ?? [])].sort((a, b) =>
                              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                            ).map(abono => (
                              <div
                                key={abono.id}
                                className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs"
                              >
                                <span className="text-zinc-500">{formatFecha(abono.created_at)}</span>
                                {abono.metodo_pago && (
                                  <span className="text-zinc-400">{METODO_LABEL[abono.metodo_pago] ?? abono.metodo_pago}</span>
                                )}
                                {abono.notas && (
                                  <span className="text-zinc-400 truncate max-w-[100px]">{abono.notas}</span>
                                )}
                                <span className="font-semibold text-green-700">+{formatPEN(abono.monto)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {deuda.notas && (
                        <p className="text-xs text-zinc-500">
                          <span className="font-semibold">Nota:</span> {deuda.notas}
                        </p>
                      )}

                      {/* Botón registrar pago (solo si no está pagado y tiene permiso) */}
                      {deuda.estado !== 'pagado' && esDueno && (
                        <div className="pt-1">
                          <button
                            onClick={() => setAbonoDialog({
                              deudaId: deuda.id,
                              monto: String(Math.max(0, deuda.monto_total - deuda.monto_pagado).toFixed(2)),
                              metodo: 'efectivo',
                              notas: '',
                            })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Registrar pago
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de pago */}
      {abonoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-900">Registrar pago</h3>
              <button onClick={() => setAbonoDialog(null)} className="text-zinc-400 hover:text-zinc-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Monto cobrado (S/)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={abonoDialog.monto}
                  onChange={e => setAbonoDialog(d => d ? { ...d, monto: e.target.value } : d)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Método de pago</label>
                <select
                  value={abonoDialog.metodo}
                  onChange={e => setAbonoDialog(d => d ? { ...d, metodo: e.target.value } : d)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">— Sin especificar —</option>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="yape">📱 Yape</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Notas (opcional)</label>
                <input
                  type="text"
                  value={abonoDialog.notas}
                  onChange={e => setAbonoDialog(d => d ? { ...d, notas: e.target.value } : d)}
                  placeholder="Observaciones…"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setAbonoDialog(null)}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={registrarAbono}
                disabled={registrando}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
              >
                {registrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
