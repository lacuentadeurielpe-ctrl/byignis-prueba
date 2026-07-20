'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Receipt,
  CalendarDays,
  Mail,
} from 'lucide-react'

export interface PagoSaas {
  id: string
  fecha: string
  monto: number | null
  moneda: string | null
  estado: string | null
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
}

const ESTADO_PAGO: Record<string, { label: string; clase: string }> = {
  approved:  { label: 'Aprobado',  clase: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  processed: { label: 'Aprobado',  clase: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  pending:   { label: 'Pendiente', clase: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  scheduled: { label: 'Programado', clase: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  rejected:  { label: 'Rechazado', clase: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  refunded:  { label: 'Devuelto',  clase: 'bg-zinc-500/10 text-zinc-500' },
}

export default function PanelSuscripcion({
  estado,
  esDueno,
  trialDiasRestantes,
  cicloFin,
  proximoCobro,
  mpConectado,
  mpEmail,
  primerCobroDiferido,
  precio,
  pagos,
}: {
  estado: string
  esDueno: boolean
  trialDiasRestantes: number | null
  cicloFin: string | null
  proximoCobro: string | null
  mpConectado: boolean
  mpEmail: string | null
  primerCobroDiferido: string | null
  precio: number
  pagos: PagoSaas[]
}) {
  const router = useRouter()
  const [cancelando, setCancelando] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enTrial = estado === 'trial'

  const handleCancelar = async () => {
    setError(null)
    setCancelando(true)
    try {
      const res = await fetch('/api/suscripcion/cancelar', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No pudimos cancelar la suscripción.')
        setCancelando(false)
        setConfirmarCancelar(false)
        return
      }
      // Al quedar suspendido, el layout redirige al paywall en el refresh
      router.refresh()
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setCancelando(false)
      setConfirmarCancelar(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Suscripción</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Administra tu plan y revisa tus pagos
        </p>
      </div>

      {/* ── Estado del plan ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                enTrial ? 'bg-blue-500/10' : 'bg-green-500/10'
              }`}
            >
              {enTrial ? (
                <Sparkles className="h-6 w-6 text-blue-500" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              )}
            </div>
            <div>
              <p className="font-semibold">Plan Todo Incluido</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {enTrial
                  ? trialDiasRestantes != null && trialDiasRestantes > 0
                    ? `Prueba gratuita — ${trialDiasRestantes} ${trialDiasRestantes === 1 ? 'día restante' : 'días restantes'} (hasta el ${formatearFecha(cicloFin)})`
                    : 'Prueba gratuita — termina hoy'
                  : `Activo — S/ ${precio} al mes`}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
              enTrial
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            {enTrial ? 'PRUEBA GRATIS' : 'ACTIVO'}
          </span>
        </div>

        {/* Datos del cobro */}
        <div className="grid gap-4 border-t border-zinc-200 p-6 sm:grid-cols-2 dark:border-white/10">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {enTrial ? 'Fin de la prueba' : 'Próximo cobro'}
              </p>
              <p className="text-sm font-semibold">
                {formatearFecha(enTrial ? cicloFin : (proximoCobro ?? cicloFin))}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Cuenta de Mercado Pago
              </p>
              <p className="text-sm font-semibold">{mpEmail ?? 'Sin conectar'}</p>
            </div>
          </div>
        </div>

        {/* ── Acciones ── */}
        {esDueno && (
          <div className="border-t border-zinc-200 p-6 dark:border-white/10">
            {enTrial ? (
              <>
                <Link
                  href="/suscripcion"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3.5 font-bold text-white shadow-md transition-all hover:from-blue-400 hover:to-blue-500 sm:w-auto sm:px-10"
                >
                  <CreditCard className="h-5 w-5" />
                  Suscribirme ahora — S/ {precio}/mes
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {primerCobroDiferido && (
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Tus días de prueba se respetan: si pagas hoy, el primer cobro será
                    recién el <strong>{formatearFecha(primerCobroDiferido)}</strong> y cubrirá
                    los siguientes 30 días.
                  </p>
                )}
              </>
            ) : mpConectado ? (
              confirmarCancelar ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <div className="mb-3 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      ¿Seguro? Al cancelar se detienen los cobros y{' '}
                      <strong>perderás el acceso al panel de inmediato</strong>. Podrás
                      reactivarla cuando quieras volviendo a suscribirte.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelar}
                      disabled={cancelando}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                    >
                      {cancelando ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Cancelando…
                        </span>
                      ) : (
                        'Sí, cancelar suscripción'
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmarCancelar(false)}
                      disabled={cancelando}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmarCancelar(true)}
                  className="text-sm font-medium text-zinc-500 underline-offset-4 transition hover:text-red-500 hover:underline"
                >
                  Cancelar suscripción
                </button>
              )
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Tu plan fue activado manualmente por el equipo de Uintegrus. Para
                cualquier cambio,{' '}
                <a
                  href="https://wa.me/51980838850?text=Hola%2C%20quiero%20hacer%20un%20cambio%20en%20mi%20suscripci%C3%B3n"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-500 hover:underline"
                >
                  escríbenos por WhatsApp
                </a>
                .
              </p>
            )}
            {error && (
              <p className="mt-3 text-sm text-red-500">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Historial de pagos ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-200 p-5 dark:border-white/10">
          <Receipt className="h-5 w-5 text-zinc-400" />
          <h2 className="font-semibold">Historial de pagos</h2>
        </div>
        {pagos.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay cobros registrados.
            {enTrial && ' Tu primer pago aparecerá aquí cuando actives la suscripción.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="p-4 font-medium">Fecha</th>
                  <th className="p-4 font-medium">Monto</th>
                  <th className="p-4 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => {
                  const info = ESTADO_PAGO[p.estado ?? ''] ?? {
                    label: p.estado ?? '—',
                    clase: 'bg-zinc-500/10 text-zinc-500',
                  }
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-white/5"
                    >
                      <td className="p-4">{formatearFecha(p.fecha)}</td>
                      <td className="p-4 font-semibold">
                        {p.monto != null ? `S/ ${Number(p.monto).toFixed(2)}` : '—'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.clase}`}
                        >
                          {info.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
