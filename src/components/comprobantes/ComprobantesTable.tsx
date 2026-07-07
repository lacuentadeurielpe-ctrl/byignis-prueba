'use client'

import { useState, useMemo } from 'react'
import { formatPEN, formatFechaHoraLima, cn } from '@/lib/utils'
import {
  Search, FileText, Download, CheckCircle2, AlertTriangle,
  RefreshCcw, Receipt, Clock, CheckCheck, XCircle, Ban,
} from 'lucide-react'
import ModalNotaCredito from './ModalNotaCredito'
import ModalNotaDebito from './ModalNotaDebito'
import ModalAnularComprobante from './ModalAnularComprobante'
import type { Comprobante as ComprobanteDB } from '@/types/database'
import { toast } from 'sonner'

interface ComprobanteExt extends ComprobanteDB {
  pedidos?: any
}

// ── Badges de estado SUNAT ────────────────────────────────────────────────────

function BadgeSunat({ comp }: { comp: ComprobanteExt }) {
  const es = comp.estado_sunat

  // Lycet path — usar estado_sunat
  if (es === 'aceptado') {
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
        <CheckCheck className="w-3 h-3" /> SUNAT OK
      </span>
    )
  }
  if (es === 'aceptado_obs') {
    return (
      <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
        <CheckCircle2 className="w-3 h-3" /> Aceptado*
      </span>
    )
  }
  if (es === 'rechazado') {
    return (
      <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
        <XCircle className="w-3 h-3" /> Rechazado
      </span>
    )
  }
  if (es === 'enviado' || es === 'baja_pendiente') {
    return (
      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
        <Clock className="w-3 h-3" /> {es === 'baja_pendiente' ? 'Anulando…' : 'Procesando'}
      </span>
    )
  }
  if (es === 'error_reintentable') {
    return (
      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
        <RefreshCcw className="w-3 h-3" /> Reintentando…
      </span>
    )
  }
  if (es === 'anulado' || es === 'baja') {
    return (
      <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
        Anulado
      </span>
    )
  }

  // Legado — usar campo estado
  switch (comp.estado) {
    case 'emitido':
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
          <CheckCircle2 className="w-3 h-3" /> Emitido
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
          <AlertTriangle className="w-3 h-3" /> Error
        </span>
      )
    case 'anulado':
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
          Anulado
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
          <Clock className="w-3 h-3" /> Pendiente
        </span>
      )
  }
}

// ── Tooltip de observaciones CDR ─────────────────────────────────────────────

function CdrInfo({ comp }: { comp: ComprobanteExt }) {
  if (comp.estado_sunat === 'error_reintentable') {
    return (
      <div className="mt-1 text-[10px] rounded px-1.5 py-0.5 max-w-[200px] bg-amber-50 text-amber-700">
        <span className="line-clamp-2">
          {comp.ultimo_error_sunat ?? 'Reintentando envío automáticamente'}
          {comp.intentos_envio > 0 && ` (intento ${comp.intentos_envio})`}
        </span>
      </div>
    )
  }
  if (comp.estado_sunat !== 'rechazado' && comp.estado_sunat !== 'aceptado_obs') return null
  const codigo = comp.sunat_cdr_codigo
  const desc   = comp.sunat_cdr_descripcion

  // Guía accionable para códigos frecuentes
  const guia = guiaSunat(codigo)

  return (
    <div className={cn(
      'mt-1 text-[10px] rounded px-1.5 py-0.5 max-w-[200px]',
      comp.estado_sunat === 'rechazado'
        ? 'bg-red-50 text-red-700'
        : 'bg-teal-50 text-teal-700',
    )}>
      {codigo && <span className="font-mono font-bold mr-1">[{codigo}]</span>}
      <span className="line-clamp-2">{guia ?? desc ?? 'Error SUNAT'}</span>
    </div>
  )
}

function guiaSunat(codigo: string | null | undefined): string | null {
  if (!codigo) return null
  const n = parseInt(codigo, 10)
  if (isNaN(n)) return null
  if (n === 0)    return null
  if (n >= 4000)  return 'Observación menor — el comprobante es válido'
  if (n === 2800) return 'Datos del emisor no coinciden con SOL — reverifica tus credenciales'
  if (n === 2335 || n === 2017) return 'Serie o número incorrecto — verifica la serie configurada'
  if (n === 1033) return 'Certificado digital expirado — renuévalo en Configuración'
  if (n === 3273) return 'IGV incorrecto — revisa la tasa IGV del producto'
  if (n >= 100 && n <= 999)  return 'Error en el XML — contacta al soporte'
  if (n >= 1000 && n <= 1999) return 'Error del sistema SUNAT — reintenta más tarde'
  if (n >= 2000 && n <= 2999) return 'Datos inválidos en el comprobante'
  if (n >= 3000 && n <= 3999) return 'Inconsistencia de montos — verifica subtotal e IGV'
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

const labelTipo = (tipo: string) => {
  switch (tipo) {
    case 'boleta':       return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-100">Boleta</span>
    case 'factura':      return <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-bold border border-purple-100">Factura</span>
    case 'nota_credito': return <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs font-bold border border-orange-100">N. Crédito</span>
    case 'nota_debito':  return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-bold border border-amber-100">N. Débito</span>
    case 'nota_venta':   return <span className="bg-zinc-50 text-zinc-700 px-2 py-0.5 rounded text-xs font-bold border border-zinc-200">Nota Venta</span>
    default: return tipo
  }
}

// Si tiene estado_sunat (Lycet), el PDF se pide on-demand a nuestro route.
// Si tiene pdf_url externa, usamos la URL directa.
// Si solo está 'emitido' sin estado_sunat (pre-Lycet), igual ofrecemos el route.
function pdfHref(comp: ComprobanteExt): string | null {
  const esSunatEmitido = comp.estado_sunat === 'aceptado' || comp.estado_sunat === 'aceptado_obs'
  const esLegadoEmitido = comp.estado === 'emitido' && !comp.estado_sunat

  if (!esSunatEmitido && !esLegadoEmitido) return null
  return comp.pdf_url ?? `/api/comprobantes/${comp.id}/pdf`
}

// Solo boletas/facturas aceptadas, y que no tengan ya una anulación en trámite.
function puedeAnular(comp: ComprobanteExt): boolean {
  if (comp.tipo !== 'boleta' && comp.tipo !== 'factura') return false
  if (comp.anulacion_solicitada) return false
  return comp.estado_sunat === 'aceptado' || comp.estado_sunat === 'aceptado_obs'
}

export default function ComprobantesTable({
  comprobantes,
  facturacionConfigurada,
}: {
  comprobantes: ComprobanteExt[]
  facturacionConfigurada: boolean
}) {
  const [busqueda, setBusqueda] = useState('')
  const [ncTarget, setNcTarget] = useState<ComprobanteExt | null>(null)
  const [ndTarget, setNdTarget] = useState<ComprobanteExt | null>(null)
  const [anularTarget, setAnularTarget] = useState<ComprobanteExt | null>(null)

  const filtrados = useMemo(() => {
    return comprobantes.filter(c => {
      if (!busqueda) return true
      const b = busqueda.toLowerCase()
      return (
        c.numero_completo?.toLowerCase().includes(b) ||
        c.cliente_nombre?.toLowerCase().includes(b) ||
        c.cliente_ruc_dni?.includes(b) ||
        c.pedidos?.numero_pedido?.toLowerCase().includes(b)
      )
    })
  }, [comprobantes, busqueda])

  // Alerta si hay boletas/facturas rechazadas definitivamente por SUNAT
  const rechazados = comprobantes.filter(c => c.estado_sunat === 'rechazado').length

  return (
    <div className="space-y-3">
      {/* Banner de alerta contextual */}
      {rechazados > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">{rechazados} comprobante(s) rechazado(s) por SUNAT.</span>{' '}
            Revisa los detalles en la tabla y corrígelos o emite una nota de crédito.
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-50/50">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar comprobante, cliente o N° Pedido..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Comprobante</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Monto</th>
                <th className="px-6 py-4">Estado SUNAT</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtrados.map((comp) => {
                const href = pdfHref(comp)
                const puedeNc = (comp.estado === 'emitido' || comp.estado_sunat === 'aceptado' || comp.estado_sunat === 'aceptado_obs')
                  && (comp.tipo === 'boleta' || comp.tipo === 'factura')

                return (
                  <tr key={comp.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                          {comp.tipo === 'nota_credito' || comp.tipo === 'nota_debito'
                            ? <RefreshCcw className={cn('w-4 h-4', comp.tipo === 'nota_credito' ? 'text-orange-500' : 'text-amber-500')} />
                            : <Receipt className="w-4 h-4 text-zinc-600" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-900">{comp.numero_completo || 'Pendiente'}</span>
                            {labelTipo(comp.tipo || '')}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {/* Mostrar fecha_emision fiscal si existe, si no la hora de creación */}
                            {comp.fecha_emision
                              ? comp.fecha_emision
                              : formatFechaHoraLima(comp.created_at)
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-900 line-clamp-1">{comp.cliente_nombre || 'Cliente Varios'}</p>
                      <p className="text-xs text-zinc-500">{comp.cliente_ruc_dni ? `Doc: ${comp.cliente_ruc_dni}` : 'Sin Documento'}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold tabular-nums text-zinc-900">{formatPEN(comp.total || 0)}</span>
                      {comp.pedidos?.numero_pedido && (
                        <div className="text-xs text-zinc-400 mt-0.5">Pedido #{comp.pedidos.numero_pedido}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <BadgeSunat comp={comp} />
                      <CdrInfo comp={comp} />
                      {comp.error_envio && !comp.estado_sunat && (
                        <p className="text-[10px] text-red-500 max-w-[160px] truncate mt-1" title={comp.error_envio}>
                          {comp.error_envio}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                            title="Descargar PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                        {comp.xml_url && (
                          <a
                            href={comp.xml_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                            title="Ver XML"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        {/* NC necesita los ítems del pedido original (el modal los lista);
                            sin el join de pedidos el modal no puede abrir, así que se oculta */}
                        {puedeNc && comp.pedidos && (
                          <button
                            onClick={() => setNcTarget(comp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 ml-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Nota de Crédito
                          </button>
                        )}
                        {puedeNc && (
                          <button
                            onClick={() => setNdTarget(comp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 ml-2 bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Nota de Débito
                          </button>
                        )}
                        {puedeAnular(comp) && (
                          <button
                            onClick={() => setAnularTarget(comp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 ml-2 bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-lg text-xs font-bold transition shadow-sm"
                            title="Anular comprobante"
                          >
                            <Ban className="w-3.5 h-3.5" /> Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Receipt className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                    <p className="text-zinc-500 font-medium">No se encontraron comprobantes</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {ncTarget && ncTarget.pedidos && (
          <ModalNotaCredito
            pedido={ncTarget.pedidos}
            comprobanteOriginal={{ id: ncTarget.id, numeroCompleto: ncTarget.numero_completo || '', tipo: ncTarget.tipo || '' }}
            onCerrar={() => setNcTarget(null)}
            onEmitida={(res) => {
              setNcTarget(null)
              toast.success(`Nota de crédito ${res.numeroCompleto} emitida`)
              setTimeout(() => window.location.reload(), 1500)
            }}
          />
        )}

        {ndTarget && (
          <ModalNotaDebito
            comprobanteOriginal={{ id: ndTarget.id, numeroCompleto: ndTarget.numero_completo || '', tipo: ndTarget.tipo || '' }}
            onCerrar={() => setNdTarget(null)}
            onEmitida={(res) => {
              setNdTarget(null)
              toast.success(`Nota de débito ${res.numeroCompleto} emitida`)
              setTimeout(() => window.location.reload(), 1500)
            }}
          />
        )}

        {anularTarget && (
          <ModalAnularComprobante
            comprobante={{ id: anularTarget.id, numeroCompleto: anularTarget.numero_completo || '' }}
            onCerrar={() => setAnularTarget(null)}
            onAnulada={() => {
              setAnularTarget(null)
              toast.success('Anulación solicitada — se procesará ante SUNAT en la próxima corrida nocturna')
              setTimeout(() => window.location.reload(), 1500)
            }}
          />
        )}
      </div>
    </div>
  )
}
