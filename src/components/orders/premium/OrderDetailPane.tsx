'use client'

import { Pedido, Repartidor } from './OrdersPremiumView'
import { cn, formatPEN, formatFechaHoraLima, labelEstadoPedido, colorEstadoPedido, labelEstadoPago, colorEstadoPago } from '@/lib/utils'
import { X, MapPin, Phone, User, Package, Clock, CreditCard, ChevronRight, FileText, Send, CheckCircle2, Truck, ExternalLink, Pencil, Trash2 } from 'lucide-react'

export default function OrderDetailPane({
  pedido,
  onClose,
  actions,
  comprobantesHooks,
  esDueno,
  puedeConfirmarPagos,
  puedeAprobarCreditos,
  repartidores,
  onEdit,
  nubefactConfigurado,
  tieneRuc
}: {
  pedido: Pedido
  onClose: () => void
  actions: any
  comprobantesHooks: any
  esDueno: boolean
  puedeConfirmarPagos: boolean
  puedeAprobarCreditos: boolean
  repartidores: Repartidor[]
  onEdit: () => void
  nubefactConfigurado: boolean
  tieneRuc: boolean
}) {

  const nombre = pedido.clientes?.nombre ?? pedido.nombre_cliente
  const tel = pedido.clientes?.telefono ?? pedido.telefono_cliente
  const dniRuc = pedido.clientes?.dni_ruc
  const colorClass = colorEstadoPedido(pedido.estado)

  // Handlers para acciones de XState adaptadas al UI
  const handleAction = async (estadoSiguiente: string, loadingKey: string) => {
    // Si la acción requiere interactividad (como asignar repartidor o rechazar),
    // esto se maneja directamente invocando las funciones de `actions`
    await actions.cambiarEstado(pedido.id, estadoSiguiente)
  }

  return (
    <div className="flex flex-col h-full bg-[#fcfcfd]">
      {/* Header Fijo */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100">
            <X className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{pedido.numero_pedido}</h2>
              <span className={cn("text-xs px-2 py-0.5 rounded-md font-semibold tracking-wide border", colorClass)}>
                {labelEstadoPedido(pedido.estado)}
              </span>
            </div>
            <p className="text-sm font-medium text-zinc-500 mt-0.5">
              {formatFechaHoraLima(pedido.created_at)} · {pedido.modalidad === 'delivery' ? 'Delivery' : 'Recojo en tienda'}
            </p>
          </div>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2">
          {pedido.estado === 'pendiente' && (
            <button
              onClick={() => handleAction('confirmado', 'confirmar')}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 shadow-sm transition-all"
            >
              Confirmar pedido
            </button>
          )}
          {pedido.estado === 'confirmado' && (
            <button
              onClick={() => handleAction('en_preparacion', 'preparar')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all"
            >
              Preparar pedido
            </button>
          )}
          {pedido.estado === 'en_preparacion' && pedido.modalidad === 'recojo' && (
            <button
              onClick={() => handleAction('listo_para_recojo', 'listo')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition-all"
            >
              Marcar como Listo
            </button>
          )}
          {pedido.estado === 'en_preparacion' && pedido.modalidad === 'delivery' && (
            // Modal simple para asignar repartidor
            <select
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm cursor-pointer outline-none"
              onChange={(e) => {
                if(e.target.value) actions.asignarRepartidor(pedido.id, e.target.value)
                e.target.value = "" // reset
              }}
            >
              <option value="">Enviar con...</option>
              {repartidores.filter(r => r.activo).map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          )}
          {(pedido.estado === 'listo_para_recojo' || pedido.estado === 'enviado') && (
            <button
              onClick={() => handleAction('entregado', 'entregar')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition-all"
            >
              Marcar Entregado
            </button>
          )}
          
          {/* Menú de opciones (Tres puntos / Editar / Eliminar) */}
          {pedido.estado_pago !== 'pagado' && pedido.estado !== 'cancelado' && (
             <button onClick={onEdit} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar pedido">
               <Pencil className="w-5 h-5" />
             </button>
          )}
          {pedido.estado !== 'cancelado' && pedido.estado !== 'devuelto' && (
            <button onClick={() => actions.setCancelDialog({ pedidoId: pedido.id, motivo: '' })} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Cancelar pedido">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          
        </div>
      </div>

      {/* Contenido Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Banner de Pago (Destacado) */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-wider">Monto Total</p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-zinc-900 tracking-tight">{formatPEN(pedido.total)}</span>
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-bold border", colorEstadoPago(pedido.estado_pago))}>
                {labelEstadoPago(pedido.estado_pago)}
              </span>
            </div>
            {pedido.cobrado_metodo && (
              <p className="text-sm font-medium text-zinc-500 mt-2">
                Método: <strong className="text-zinc-700 capitalize">{pedido.cobrado_metodo}</strong>
              </p>
            )}
          </div>
          
          {/* Botón de Cobro Rápido si no está pagado */}
          {pedido.estado_pago !== 'pagado' && puedeConfirmarPagos && pedido.estado !== 'cancelado' && (
             <div className="flex flex-col gap-2">
                <select 
                  className="px-4 py-2 border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                  onChange={(e) => {
                    if(e.target.value) actions.actualizarPago(pedido.id, 'pagado', e.target.value)
                  }}
                  value=""
                >
                  <option value="">Confirmar pago...</option>
                  <option value="yape">Yape / Plin</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta (POS)</option>
                </select>
                {puedeAprobarCreditos && pedido.metodo_pago === 'credito' && (
                  <button onClick={() => actions.setCreditoDialog({ pedidoId: pedido.id, fechaLimite: '', notas: '' })} className="px-4 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all">
                    Aprobar Crédito
                  </button>
                )}
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Items y Comprobantes */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Lista de Items */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-zinc-400" />
                  Productos del Pedido
                </h3>
                <span className="text-sm font-medium text-zinc-500">{pedido.items_pedido.length} items</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {pedido.items_pedido.map(item => (
                  <div key={item.id} className="p-5 flex items-start justify-between hover:bg-zinc-50/50 transition-colors">
                    <div>
                      <p className="font-semibold text-zinc-900 leading-tight">{item.nombre_producto}</p>
                      <p className="text-sm text-zinc-500 mt-1">{item.cantidad} x {formatPEN(item.precio_unitario)}</p>
                    </div>
                    <span className="font-bold text-zinc-900">{formatPEN(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel de Facturación / Notas de Venta */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm p-5">
               <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  Documentos y Comprobantes
                </h3>
                
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => comprobantesHooks.verComprobante(pedido.id, 'nota_venta')} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all">
                    <FileText className="w-4 h-4" /> Ver Nota de Venta
                  </button>

                  {tieneRuc && nubefactConfigurado && (
                    <>
                      {/* Lógica de botones de boleta/factura adaptada del original */}
                      {pedido.comprobantes?.some(c => c.tipo === 'boleta') ? (
                        <button onClick={() => comprobantesHooks.verComprobante(pedido.id, 'boleta')} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all border border-blue-200">
                          <FileText className="w-4 h-4" /> Ver Boleta SUNAT
                        </button>
                      ) : (
                        <button onClick={() => comprobantesHooks.setModalBoleta(pedido)} className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-all">
                          Emitir Boleta
                        </button>
                      )}

                      {pedido.comprobantes?.some(c => c.tipo === 'factura') ? (
                        <button onClick={() => comprobantesHooks.verComprobante(pedido.id, 'factura')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all border border-indigo-200">
                          <FileText className="w-4 h-4" /> Ver Factura SUNAT
                        </button>
                      ) : (
                        <button onClick={() => comprobantesHooks.setModalFactura(pedido)} className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-all">
                          Emitir Factura
                        </button>
                      )}
                    </>
                  )}
                </div>
            </div>

          </div>

          {/* Columna Derecha: Cliente e Info */}
          <div className="space-y-6">
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm p-5">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-zinc-400" />
                Información del Cliente
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Nombre</p>
                  <p className="font-medium text-zinc-900">{nombre || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Teléfono</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-900">{tel || '—'}</p>
                    {tel && (
                      <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors">
                        <Send className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
                {dniRuc && (
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">DNI/RUC</p>
                    <p className="font-medium text-zinc-900">{dniRuc}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Logística */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm p-5">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-zinc-400" />
                Logística
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Modalidad</p>
                  <p className="font-medium text-zinc-900 capitalize">{pedido.modalidad}</p>
                </div>
                {pedido.modalidad === 'delivery' && pedido.direccion_entrega && (
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Dirección de Entrega</p>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                      <p className="font-medium text-zinc-900 text-sm leading-snug">{pedido.direccion_entrega}</p>
                    </div>
                  </div>
                )}
                {pedido.notas && (
                  <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                    <p className="text-[11px] font-bold text-yellow-800 uppercase tracking-wider mb-1">Notas del Pedido</p>
                    <p className="text-sm font-medium text-yellow-900">{pedido.notas}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
