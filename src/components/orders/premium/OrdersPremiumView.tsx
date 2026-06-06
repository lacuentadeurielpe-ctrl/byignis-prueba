'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Download, Mic, Bell, Search, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

import type { Rol } from '@/lib/auth/roles'
import { checkPermiso, type PermisoMap } from '@/lib/auth/permisos'
import { useOrderActions } from '../hooks/useOrderActions'
import { useOrderComprobantes } from '../hooks/useOrderComprobantes'
import { useOrderFilters } from '../hooks/useOrderFilters'

import NuevoPedidoModal from '../NuevoPedidoModal'
import PedidoVozModal from '../PedidoVozModal'
import EditarPedidoModal from '../EditarPedidoModal'
import ModalEmitirBoleta from '@/components/comprobantes/ModalEmitirBoleta'
import ModalEmitirFactura from '@/components/comprobantes/ModalEmitirFactura'
import ModalNotaCredito from '@/components/comprobantes/ModalNotaCredito'
import ModalCancelarPedido from '../components/ModalCancelarPedido'
import ModalAprobarCredito from '../components/ModalAprobarCredito'

import OrdersInboxList from './OrdersInboxList'
import OrderDetailPane from './OrderDetailPane'

// ── Tipos ────────────────────────────────────────────────────────────────
// Igual a OrdersTable
export interface Repartidor { id: string; nombre: string; telefono: string | null; activo: boolean }
export interface ItemPedido { id: string; nombre_producto: string; cantidad: number; precio_unitario: number; subtotal: number }
export interface EntregaResumen { id: string; estado: string; vehiculos: { nombre: string; tipo: string } | null }
export interface Pedido {
  id: string
  numero_pedido: string
  estado: string
  modalidad: string
  total: number
  costo_total: number | null
  notas: string | null
  motivo_cancelacion: string | null
  repartidor_id: string | null
  cobrado_monto: number | null
  cobrado_metodo: string | null
  incidencia_tipo: string | null
  incidencia_desc: string | null
  metodo_pago: string | null
  estado_pago: string
  pago_confirmado_por: string | null
  pago_confirmado_at: string | null
  created_at: string
  nombre_cliente: string
  telefono_cliente: string
  eta_minutos: number | null
  direccion_entrega: string | null
  fecha_entrega_programada: string | null
  clientes: { nombre: string | null; telefono: string | null; dni_ruc: string | null } | null
  zonas_delivery: { nombre: string } | null
  items_pedido: ItemPedido[]
  entregas: EntregaResumen[] | null
  comprobantes?: { id: string; tipo: string; numero_completo: string; estado: string; pdf_url: string | null }[]
}

export interface Producto { id: string; nombre: string; unidad: string; precio_base: number; precio_compra: number; stock: number }
export interface Zona { id: string; nombre: string; tiempo_estimado_min: number }

export default function OrdersPremiumView({ pedidos: inicial, productos = [], zonas = [], ferreteriaId, rol = 'dueno', repartidores = [], permisos, nubefactConfigurado = false, tieneRuc = false, initEstado, initPedidoId }: {
  pedidos: Pedido[]
  productos?: Producto[]
  zonas?: Zona[]
  ferreteriaId?: string
  rol?: Rol
  repartidores?: Repartidor[]
  permisos?: Partial<PermisoMap>
  nubefactConfigurado?: boolean
  tieneRuc?: boolean
  initEstado?: string
  initPedidoId?: string
}) {
  const router = useRouter()
  const esDueno = rol === 'dueno'
  const sessionData = { rol, permisos: permisos ?? {} }
  const puedeConfirmarPagos = checkPermiso(sessionData, 'registrar_pagos')
  const puedeAprobarCreditos = checkPermiso(sessionData, 'aprobar_creditos')
  const [pedidos, setPedidos] = useState(inicial)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalVoz, setModalVoz]     = useState(false)
  const [nuevoPedidoAlert, setNuevoPedidoAlert] = useState(false)
  const [cancelDialog, setCancelDialog] = useState<{ pedidoId: string; motivo: string } | null>(null)
  const [creditoDialog, setCreditoDialog] = useState<{ pedidoId: string; fechaLimite: string; notas: string } | null>(null)

  const actions = useOrderActions(setPedidos, setCancelDialog, setCreditoDialog)
  const comprobantesHooks = useOrderComprobantes(pedidos)
  const filters = useOrderFilters(pedidos)

  const [modalEditar, setModalEditar] = useState<typeof pedidos[0] | null>(null)
  // Selección del pedido en lugar de acordeón expandido
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const selectedOrder = pedidos.find(p => p.id === selectedOrderId)

  // Handle deep linking initialization
  useEffect(() => {
    if (initEstado) {
      filters.setFiltroEstado(initEstado)
    }
    if (initPedidoId) {
      setSelectedOrderId(initPedidoId)
    }
  }, [initEstado, initPedidoId])

  // Realtime
  useEffect(() => {
    if (!ferreteriaId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`pedidos-${ferreteriaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `ferreteria_id=eq.${ferreteriaId}` },
        () => setNuevoPedidoAlert(true)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ferreteriaId])

  function exportarCSV() {
    // Igual que OrdersTable
    const headers = esDueno
      ? ['N° Pedido', 'Cliente', 'Teléfono', 'Modalidad', 'Estado', 'Total', 'Costo', 'Ganancia', 'Motivo cancelación', 'Fecha']
      : ['N° Pedido', 'Cliente', 'Teléfono', 'Modalidad', 'Estado', 'Motivo cancelación', 'Fecha']

    const filas = [
      headers,
      ...filters.filtrados.map((p) => {
        const nombre = p.clientes?.nombre ?? p.nombre_cliente
        const tel = p.clientes?.telefono ?? p.telefono_cliente
        const base = [ p.numero_pedido, nombre, tel, p.modalidad, p.estado ]
        if (esDueno) {
          const ganancia = p.costo_total != null ? (p.total - p.costo_total).toFixed(2) : ''
          return [...base, p.total.toFixed(2), p.costo_total?.toFixed(2) ?? '', ganancia, p.motivo_cancelacion ?? '', new Date(p.created_at).toLocaleDateString('es-PE')]
        }
        return [...base, p.motivo_cancelacion ?? '', new Date(p.created_at).toLocaleDateString('es-PE')]
      }),
    ]
    const csv = filas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex-1 min-w-[280px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, teléfono o N° pedido..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
            value={filters.busqueda}
            onChange={(e) => filters.setBusqueda(e.target.value)}
          />
          {filters.busqueda && (
            <button onClick={() => filters.setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <Plus className="w-4 h-4 text-zinc-400 rotate-45" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {nuevoPedidoAlert && (
            <button onClick={() => { router.refresh(); setNuevoPedidoAlert(false); setSelectedOrderId(null) }} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-all animate-pulse shadow-md">
              <Bell className="w-4 h-4" /> Hay nuevos pedidos
            </button>
          )}
          
          <button onClick={exportarCSV} className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-all">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>

          {checkPermiso(sessionData, 'crear_pedidos') && (
            <button onClick={() => setModalVoz(true)} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all border border-zinc-200">
              <Mic className="w-4 h-4" /> Por voz
            </button>
          )}

          {checkPermiso(sessionData, 'crear_pedidos') && (
            <button onClick={() => setModalNuevo(true)} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-all shadow-md hover:shadow-lg">
              <Plus className="w-4 h-4" /> Nuevo pedido
            </button>
          )}
        </div>
      </div>

      {/* Split View Container */}
      <div className="flex flex-1 overflow-hidden bg-white border border-zinc-200 rounded-2xl shadow-sm">
        
        {/* Left Pane: Inbox List */}
        <div className={cn("flex flex-col border-r border-zinc-100 transition-all duration-300", selectedOrderId ? "w-[35%] min-w-[320px] hidden md:flex" : "w-full")}>
          <OrdersInboxList 
            pedidos={filters.filtrados} 
            selectedOrderId={selectedOrderId} 
            onSelectOrder={(id) => setSelectedOrderId(id === selectedOrderId ? null : id)} 
            filters={filters}
          />
        </div>

        {/* Right Pane: Details */}
        <AnimatePresence mode="wait">
          {selectedOrderId && selectedOrder && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 flex flex-col bg-[#fcfcfd] relative overflow-hidden"
            >
              <OrderDetailPane 
                pedido={selectedOrder}
                onClose={() => setSelectedOrderId(null)}
                actions={actions}
                comprobantesHooks={comprobantesHooks}
                esDueno={esDueno}
                puedeConfirmarPagos={puedeConfirmarPagos}
                puedeAprobarCreditos={puedeAprobarCreditos}
                repartidores={repartidores}
                onEdit={() => setModalEditar(selectedOrder)}
                nubefactConfigurado={nubefactConfigurado}
                tieneRuc={tieneRuc}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modales (Ocultos) */}
      {modalNuevo && (
        <NuevoPedidoModal onClose={() => { setModalNuevo(false); router.refresh() }} productos={productos} zonas={zonas} />
      )}
      {modalVoz && (
        <PedidoVozModal onClose={() => { setModalVoz(false); router.refresh() }} productos={productos} zonas={zonas} />
      )}
      {modalEditar && (
        <EditarPedidoModal pedido={modalEditar} onClose={() => { setModalEditar(null); router.refresh() }} productos={productos} zonas={zonas} />
      )}
      {cancelDialog && (
        <ModalCancelarPedido
          cancelDialog={cancelDialog}
          setCancelDialog={setCancelDialog}
          cambiarEstado={(id, estado, motivo) => actions.cambiarEstado(id, estado, motivo)}
        />
      )}
      {creditoDialog && (
        <ModalAprobarCredito
          creditoDialog={creditoDialog}
          setCreditoDialog={setCreditoDialog}
          aprobarCredito={(dialog) => actions.aprobarCredito(dialog)}
          aprobandoCredito={actions.aprobandoCredito}
        />
      )}

      {comprobantesHooks.modalBoleta && (
        <ModalEmitirBoleta 
          pedido={comprobantesHooks.modalBoleta} 
          onClose={() => comprobantesHooks.setModalBoleta(null)} 
          onEmitida={(resultado) => { 
            comprobantesHooks.handleBoletaEmitida(comprobantesHooks.modalBoleta.id, resultado)
            router.refresh() 
          }} 
        />
      )}
      {comprobantesHooks.modalFactura && (
        <ModalEmitirFactura 
          pedido={comprobantesHooks.modalFactura} 
          onClose={() => comprobantesHooks.setModalFactura(null)} 
          onEmitida={(resultado) => { 
            comprobantesHooks.handleFacturaEmitida(comprobantesHooks.modalFactura.id, resultado)
            router.refresh() 
          }} 
        />
      )}
      {comprobantesHooks.modalNC && (
        <ModalNotaCredito 
          comprobanteOriginal={comprobantesHooks.modalNC.comprobanteOriginal!} 
          pedido={comprobantesHooks.modalNC.pedido} 
          onCerrar={() => comprobantesHooks.setModalNC(null)} 
          onEmitida={() => { 
            comprobantesHooks.setModalNC(null)
            router.refresh() 
          }} 
        />
      )}</div>
  )
}
