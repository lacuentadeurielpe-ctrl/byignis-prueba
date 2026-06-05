'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trash2,
  Plus,
  ArrowLeft,
  Loader2,
  Package2,
  CheckCircle,
  AlertTriangle,
  Building2,
  Calendar,
  FileSpreadsheet,
  PlusCircle,
  HelpCircle
} from 'lucide-react'
import { type Producto, type Proveedor } from '@/types/database'
import { formatPEN } from '@/lib/utils'
import ConversionPaqueteModal from './ConversionPaqueteModal'

interface ItemRow {
  productoId: string | null
  nombreProducto: string
  codigoInterno: string | null
  esFormal: boolean
  tipoItem: 'unitario' | 'paquete_a_unidades'
  cantidadComprada: number
  unidadCompra: string
  conversionAUnidades: number
  precioCompraUnitario: number
  subtotal: number
  unidadesIngresadasAlStock: number
}

export default function CompraForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cabecera de la compra
  const [tipo, setTipo] = useState<'formal' | 'informal'>('formal')
  const [proveedorId, setProveedorId] = useState<string>('')
  const [proveedorNombre, setProveedorNombre] = useState<string>('')
  
  // Datos Factura (Formal)
  const [numeroFactura, setNumeroFactura] = useState('')
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0])
  const [rucProveedor, setRucProveedor] = useState('')
  const [razonSocialProveedor, setRazonSocialProveedor] = useState('')
  const [notas, setNotas] = useState('')

  // Proveedores registrados
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [nuevoProvMode, setNuevoProvMode] = useState(false)
  const [nuevoProv, setNuevoProv] = useState({ nombre: '', telefono: '', contacto: '' })
  const [loadingProv, setLoadingProv] = useState(false)

  // Catálogo de productos para autocompletado
  const [productos, setProductos] = useState<Producto[]>([])
  
  // Estado para el modal de conversión
  const [modalConversionOpen, setModalConversionOpen] = useState(false)
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null)

  // Ítems de la compra
  const [items, setItems] = useState<ItemRow[]>([
    {
      productoId: null,
      nombreProducto: '',
      codigoInterno: null,
      esFormal: true,
      tipoItem: 'unitario',
      cantidadComprada: 1,
      unidadCompra: 'UND',
      conversionAUnidades: 1,
      precioCompraUnitario: 0,
      subtotal: 0,
      unidadesIngresadasAlStock: 1
    }
  ])

  // Carga inicial de datos
  useEffect(() => {
    // Cargar proveedores
    fetch('/api/proveedores')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProveedores(data))
      .catch(() => {})

    // Cargar productos activos
    fetch('/api/products?activos=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProductos(data))
      .catch(() => {})
  }, [])

  // Buscar un proveedor al seleccionarlo
  useEffect(() => {
    if (proveedorId && proveedorId !== 'nuevo' && proveedorId !== 'libre') {
      const p = proveedores.find((prov) => prov.id === proveedorId)
      if (p) {
        setProveedorNombre(p.nombre)
        // Intentar autocompletar RUC si tuviera (en este modelo RUC no está directo en proveedores, pero lo dejamos vacío)
      }
    } else if (proveedorId === 'libre') {
      setProveedorNombre('')
    }
  }, [proveedorId, proveedores])

  // Crear nuevo proveedor
  async function handleCrearProveedor(e: React.MouseEvent) {
    e.preventDefault()
    if (!nuevoProv.nombre.trim()) {
      alert('El nombre del proveedor es obligatorio')
      return
    }

    setLoadingProv(true)
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoProv),
      })
      if (res.ok) {
        const data = await res.json()
        setProveedores((prev) => [...prev, data])
        setProveedorId(data.id)
        setProveedorNombre(data.nombre)
        setNuevoProvMode(false)
        setNuevoProv({ nombre: '', telefono: '', contacto: '' })
      } else {
        const err = await res.json()
        alert(err.error || 'Error al crear proveedor')
      }
    } catch {
      alert('Error de red al crear proveedor')
    } finally {
      setLoadingProv(false)
    }
  }

  // Agregar fila de ítem
  function agregarFila() {
    setItems((prev) => [
      ...prev,
      {
        productoId: null,
        nombreProducto: '',
        codigoInterno: null,
        esFormal: tipo === 'formal',
        tipoItem: 'unitario',
        cantidadComprada: 1,
        unidadCompra: 'UND',
        conversionAUnidades: 1,
        precioCompraUnitario: 0,
        subtotal: 0,
        unidadesIngresadasAlStock: 1
      }
    ])
  }

  // Eliminar fila de ítem
  function eliminarFila(idx: number) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // Actualizar campo de fila
  function actualizarFila(idx: number, updates: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item

        const newItem = { ...item, ...updates }
        
        // Calcular stock final
        newItem.unidadesIngresadasAlStock =
          newItem.cantidadComprada * newItem.conversionAUnidades

        // Calcular subtotal de fila
        newItem.subtotal = newItem.cantidadComprada * newItem.precioCompraUnitario

        return newItem
      })
    )
  }

  // Seleccionar producto del catálogo en una fila
  function handleSeleccionarProducto(idx: number, prodId: string) {
    const prod = productos.find((p) => p.id === prodId)
    if (prod) {
      actualizarFila(idx, {
        productoId: prod.id,
        nombreProducto: prod.nombre,
        codigoInterno: prod.codigo_interno,
        unidadCompra: prod.unidad,
        conversionAUnidades: 1,
        precioCompraUnitario: Number(prod.precio_compra) || 0
      })
    }
  }

  // Totales
  const totalNeto = items.reduce((sum, item) => sum + item.subtotal, 0)
  // En Perú, si la compra es Formal, calculamos la Base Imponible y el IGV
  const isFormal = tipo === 'formal'
  const totalBruto = isFormal ? totalNeto / 1.18 : totalNeto
  const igv = isFormal ? totalNeto - totalBruto : 0

  // Guardar Compra
  async function submitCompra(estado: 'borrador' | 'recibida') {
    setError(null)

    // Validaciones
    if (tipo === 'formal') {
      if (!numeroFactura.trim()) {
        setError('El número de factura es obligatorio en compras formales.')
        return
      }
      if (!rucProveedor.trim() || rucProveedor.length !== 11) {
        setError('El RUC del proveedor debe tener exactamente 11 dígitos.')
        return
      }
      if (!razonSocialProveedor.trim()) {
        setError('La Razón Social del proveedor es obligatoria.')
        return
      }
    } else {
      if (!proveedorNombre.trim() && proveedorId === 'libre') {
        setError('Debes especificar un nombre para el proveedor informal o seleccionar uno.')
        return
      }
    }

    // Validar ítems
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.nombreProducto.trim()) {
        setError(`El nombre del producto en la línea ${i + 1} es obligatorio.`)
        return
      }
      if (it.cantidadComprada <= 0) {
        setError(`La cantidad comprada en la línea ${i + 1} debe ser mayor a 0.`)
        return
      }
      if (it.precioCompraUnitario < 0) {
        setError(`El precio de compra en la línea ${i + 1} no puede ser negativo.`)
        return
      }
    }

    setLoading(true)

    const payload = {
      tipo,
      proveedorId: proveedorId && proveedorId !== 'nuevo' && proveedorId !== 'libre' ? proveedorId : null,
      proveedorNombre: proveedorId === 'libre' ? proveedorNombre : (nuevoProvMode ? nuevoProv.nombre : proveedorNombre),
      numeroFactura: tipo === 'formal' ? numeroFactura : null,
      fechaFactura: tipo === 'formal' ? fechaFactura : null,
      rucProveedor: tipo === 'formal' ? rucProveedor : null,
      razonSocialProveedor: tipo === 'formal' ? razonSocialProveedor : null,
      totalBruto: Number(totalBruto.toFixed(2)),
      igv: Number(igv.toFixed(2)),
      totalNeto: Number(totalNeto.toFixed(2)),
      estado,
      notas: notas.trim() || null,
      items: items.map((it) => ({
        productoId: it.productoId,
        nombreProducto: it.nombreProducto,
        codigoInterno: it.codigoInterno,
        esFormal: it.esFormal,
        tipoItem: it.tipoItem,
        cantidadComprada: Number(it.cantidadComprada),
        unidadCompra: it.unidadCompra,
        conversionAUnidades: Number(it.conversionAUnidades),
        precioCompraUnitario: Number(it.precioCompraUnitario),
        subtotal: Number(it.subtotal.toFixed(2)),
        unidadesIngresadasAlStock: Number(it.unidadesIngresadasAlStock)
      }))
    }

    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        router.push('/dashboard/contabilidad/compras')
        router.refresh()
      } else {
        const err = await res.json()
        setError(err.error || 'Error al guardar el registro de compra.')
      }
    } catch {
      setError('Error de conexión con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/contabilidad/compras')}
            className="w-9 h-9 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-center transition"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Registrar Compra de Mercadería</h1>
            <p className="text-xs text-zinc-400">Ingreso de stock e historial de facturación de proveedores</p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Datos del Proveedor y Comprobante */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-950">Tipo y Proveedor</h2>
            
            {/* Tipo Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tipo de Compra</label>
              <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setTipo('formal')
                    setItems((prev) => prev.map((item) => ({ ...item, esFormal: true })))
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    tipo === 'formal'
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Formal (Facturada)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipo('informal')
                    setItems((prev) => prev.map((item) => ({ ...item, esFormal: false })))
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    tipo === 'informal'
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Informal (Mercado)
                </button>
              </div>
            </div>

            {/* Proveedor Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-500">Proveedor</label>
                <button
                  type="button"
                  onClick={() => setNuevoProvMode(!nuevoProvMode)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  {nuevoProvMode ? 'Seleccionar existente' : '+ Nuevo proveedor'}
                </button>
              </div>

              {nuevoProvMode ? (
                <div className="space-y-2.5 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nuevo Proveedor</p>
                  <div>
                    <input
                      value={nuevoProv.nombre}
                      onChange={(e) => setNuevoProv((p) => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre / Razón Social"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={nuevoProv.telefono}
                      onChange={(e) => setNuevoProv((p) => ({ ...p, telefono: e.target.value }))}
                      placeholder="Teléfono"
                      className="px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                    <input
                      value={nuevoProv.contacto}
                      onChange={(e) => setNuevoProv((p) => ({ ...p, contacto: e.target.value }))}
                      placeholder="Contacto"
                      className="px-3 py-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loadingProv}
                    onClick={handleCrearProveedor}
                    className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    {loadingProv && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Registrar Proveedor
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                  >
                    <option value="">Selecciona un proveedor</option>
                    <option value="libre">Proveedor Informal / Temporal</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>

                  {proveedorId === 'libre' && (
                    <input
                      value={proveedorNombre}
                      onChange={(e) => setProveedorNombre(e.target.value)}
                      placeholder="Nombre del proveedor informal..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Datos Factura (Solo si es Formal) */}
          {tipo === 'formal' && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4 transition">
              <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-zinc-500" />
                Datos de la Factura
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">N° de Factura / Serie</label>
                  <input
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                    placeholder="Ej: F001-00045612"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Fecha de Factura</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="date"
                      value={fechaFactura}
                      onChange={(e) => setFechaFactura(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-3 space-y-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Identificación Fiscal Proveedor</p>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1">RUC del Proveedor</label>
                    <input
                      value={rucProveedor}
                      onChange={(e) => setRucProveedor(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="11 dígitos"
                      maxLength={11}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 transition font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1">Razón Social</label>
                    <input
                      value={razonSocialProveedor}
                      onChange={(e) => setRazonSocialProveedor(e.target.value)}
                      placeholder="Ej: Aceros Arequipa S.A."
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-2">
            <label className="block text-xs font-semibold text-zinc-500">Notas / Comentarios Internos</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Ej: llegó mercadería con descuento adicional por campaña..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition resize-none"
            />
          </div>
        </div>

        {/* Columna Derecha: Detalle de Productos (Líneas de Compra) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-950">Líneas de la Compra</h2>
              <button
                type="button"
                onClick={agregarFila}
                className="flex items-center gap-1 px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-xl transition"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Ítem
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 space-y-3 relative group"
                >
                  {/* Botón de eliminación en la parte superior derecha */}
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarFila(idx)}
                      className="absolute right-3 top-3 p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Búsqueda / Vinculación del Producto */}
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Producto en Catálogo <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={item.productoId || ''}
                        onChange={(e) => handleSeleccionarProducto(idx, e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                      >
                        <option value="">-- Escribir producto libre o nuevo --</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.codigo_interno ? `[${p.codigo_interno}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Nombre Producto (si no está en catálogo o se quiere editar el snapshot) */}
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Nombre de Visualización
                      </label>
                      <input
                        value={item.nombreProducto}
                        onChange={(e) => actualizarFila(idx, { nombreProducto: e.target.value })}
                        placeholder="Ej: Tubo de PVC de 1/2 pulgada"
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    {/* Cantidad Comprada */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Cant. Comprada
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.cantidadComprada}
                        onChange={(e) => actualizarFila(idx, { cantidadComprada: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 transition font-bold"
                      />
                    </div>

                    {/* Unidad y Conversión */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          Presentación
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRowIndex(idx)
                            setModalConversionOpen(true)
                          }}
                          className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          Convertir
                        </button>
                      </div>
                      <div className="px-3 py-2 rounded-xl border border-zinc-200 text-xs bg-white flex items-center justify-between min-h-[34px]">
                        <span className="font-semibold text-zinc-700 truncate">{item.unidadCompra}</span>
                        {item.conversionAUnidades > 1 && (
                          <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                            x{item.conversionAUnidades}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Costo Unitario de Compra */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Costo Compra (S/)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.precioCompraUnitario}
                        onChange={(e) => actualizarFila(idx, { precioCompraUnitario: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 transition font-mono text-right"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="text-right pb-2 bg-zinc-100/50 border border-zinc-200/40 rounded-xl px-3 py-1">
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Subtotal</p>
                      <p className="text-xs font-extrabold text-zinc-900 tabular-nums">
                        {formatPEN(item.subtotal)}
                      </p>
                    </div>
                  </div>

                  {/* Stock Informativo */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-100/80 bg-zinc-50/20 px-1 rounded-b-xl">
                    <span className="flex items-center gap-1.5 font-mono text-zinc-400">
                      {item.codigoInterno ? `Cód: ${item.codigoInterno}` : 'Producto temporal / Sin código asignado'}
                    </span>
                    <span className="font-semibold text-zinc-700">
                      Se ingresarán al stock: <strong className="text-zinc-950">{item.unidadesIngresadasAlStock} unidades</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Sumatoria / Totales */}
            <div className="bg-zinc-50 rounded-2xl border border-zinc-100 p-4 flex flex-col items-end space-y-1.5 pt-4">
              <div className="flex justify-between w-64 text-sm text-zinc-500">
                <span>Base Imponible (Bruto):</span>
                <span className="font-mono tabular-nums">{formatPEN(totalBruto)}</span>
              </div>
              <div className="flex justify-between w-64 text-sm text-zinc-500">
                <span>IGV (18%):</span>
                <span className="font-mono tabular-nums">{formatPEN(igv)}</span>
              </div>
              <div className="flex justify-between w-64 text-base font-bold text-zinc-950 pt-2 border-t border-zinc-200">
                <span>Total Compra:</span>
                <span className="font-mono tabular-nums text-lg text-emerald-600">{formatPEN(totalNeto)}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2.5 text-red-700 text-sm">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard/contabilidad/compras')}
              className="text-sm text-zinc-500 hover:text-zinc-700 font-medium transition"
            >
              Volver
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => submitCompra('borrador')}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold rounded-xl transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar en Borrador
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => submitCompra('recibida')}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-900 disabled:bg-zinc-700 text-white text-sm font-semibold rounded-xl transition shadow-md disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Recibir y Registrar Stock
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Conversión de Paquete */}
      {modalConversionOpen && activeRowIndex !== null && (
        <ConversionPaqueteModal
          open={modalConversionOpen}
          onClose={() => {
            setModalConversionOpen(false)
            setActiveRowIndex(null)
          }}
          unidadBase={items[activeRowIndex].unidadCompra || 'UND'}
          onSave={({ unidadCompra, factor }) => {
            actualizarFila(activeRowIndex, {
              unidadCompra,
              conversionAUnidades: factor,
              tipoItem: factor > 1 ? 'paquete_a_unidades' : 'unitario'
            })
          }}
        />
      )}
    </div>
  )
}
