'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, Plus, ClipboardList, Trash2, Check, RefreshCw, 
  Send, Download, Tag, FileText, AlertTriangle, Building, 
  Bookmark, Package, Sparkles, X, ChevronDown, CheckCircle,
  Phone, User, Calendar, ShoppingBag, Eye, Trash, CheckSquare
} from 'lucide-react'
import { type Producto, type Categoria, type Proveedor, type OrdenCompra } from '@/types/database'
import { formatPEN } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import ExcelJS from 'exceljs'

interface SupplierOrdersManagerProps {
  productos: Producto[]
  categorias: Categoria[]
  proveedoresIniciales: Proveedor[]
  ordenesIniciales: OrdenCompra[]
}

interface ManualItem {
  id: string
  nombre: string
  marca: string
  proveedor: string
  proveedorId?: string
  cantidad: number
  precio_compra: number
  unidad: string
}

export default function SupplierOrdersManager({ 
  productos: initialProductos, 
  categorias,
  proveedoresIniciales,
  ordenesIniciales
}: SupplierOrdersManagerProps) {
  const router = useRouter()

  // --- Tabs Principales ---
  // 'lista' = Historial de proformas, 'nuevo' = Creador de proforma, 'proveedores' = Administrar proveedores
  const [activeTab, setActiveTab] = useState<'lista' | 'nuevo' | 'proveedores'>('lista')

  // --- Estados locales ---
  const [productos, setProductos] = useState<Producto[]>(initialProductos)
  const [proveedores, setProveedores] = useState<Proveedor[]>(proveedoresIniciales)
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>(ordenesIniciales)
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  
  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [proveedorFiltro, setProveedorFiltro] = useState<string>('todos')
  const [mostrarTodos, setMostrarTodos] = useState(false) // false = solo stock bajo, true = todo el catálogo
  
  // Selección en el creador
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [selectedManualIds, setSelectedManualIds] = useState<string[]>([])
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({})
  const [orderCosts, setOrderCosts] = useState<Record<string, number>>({})

  // Estados de carga
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [creandoProveedor, setCreandoProveedor] = useState(false)
  const [creandoOrden, setCreandoOrden] = useState(false)

  // Selección de proveedor en la nueva orden
  const [selectedProveedorId, setSelectedProveedorId] = useState<string>('')
  const [customProveedorNombre, setCustomProveedorNombre] = useState<string>('')

  // Edición de campos inline en el catálogo
  const [editProveedorId, setEditProveedorId] = useState<string | null>(null)
  const [editMarcaId, setEditMarcaId] = useState<string | null>(null)

  // Formulario Proveedor
  const [formProveedor, setFormProveedor] = useState({
    nombre: '',
    telefono: '',
    contacto: ''
  })

  // Formulario Ítem Manual (Fuera de catálogo)
  const [mostrarFormManual, setMostrarFormManual] = useState(false)
  const [formManual, setFormManual] = useState({
    nombre: '',
    marca: '',
    cantidad: 1,
    precio_compra: 0,
    unidad: 'unidad'
  })

  // Toast notifications state & helper
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(curr => curr?.message === message ? null : curr)
    }, 3500)
  }

  // --- Helpers ---
  const getProveedorNombre = (id: string | null) => {
    if (!id) return ''
    return proveedores.find(p => p.id === id)?.nombre || ''
  }

  const getCantidadRecomendada = (p: Producto) => {
    if (orderQuantities[p.id] !== undefined) return orderQuantities[p.id]
    if (p.stock_minimo !== null && p.stock < p.stock_minimo) {
      return p.stock_minimo - p.stock
    }
    return 1
  }

  const getCostoDefecto = (p: Producto) => {
    if (orderCosts[p.id] !== undefined) return orderCosts[p.id]
    return p.precio_compra || 0
  }

  // --- Filtrado del Catálogo para Nueva Orden ---
  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      // Búsqueda por término (nombre, descripción, marca, proveedor)
      const matchTerm = busqueda.trim() === '' || [
        p.nombre,
        p.descripcion ?? '',
        p.marca ?? '',
        p.proveedor ?? ''
      ].some(str => str.toLowerCase().includes(busqueda.toLowerCase()))

      // Filtro de proveedor
      let matchProveedor = true
      if (selectedProveedorId) {
        const pNombre = getProveedorNombre(selectedProveedorId)
        matchProveedor = p.proveedor?.trim().toLowerCase() === pNombre.toLowerCase()
      } else if (proveedorFiltro === 'sin_proveedor') {
        matchProveedor = !p.proveedor || p.proveedor.trim() === ''
      } else if (proveedorFiltro !== 'todos') {
        matchProveedor = p.proveedor?.trim().toLowerCase() === proveedorFiltro.toLowerCase()
      }

      // Filtro de stock bajo (alerta)
      const esBajoStock = p.stock_minimo !== null ? p.stock <= p.stock_minimo : p.stock === 0
      const matchStock = mostrarTodos || esBajoStock

      return matchTerm && matchProveedor && matchStock
    })
  }, [productos, busqueda, proveedorFiltro, selectedProveedorId, mostrarTodos, proveedores])

  // --- Proveedor activo para nueva orden ---
  const activeProveedorNombre = useMemo(() => {
    if (selectedProveedorId) {
      return getProveedorNombre(selectedProveedorId)
    }
    return customProveedorNombre.trim()
  }, [selectedProveedorId, customProveedorNombre, proveedores])

  // --- Totales de la nueva orden ---
  const statsNuevaOrden = useMemo(() => {
    let totalItems = 0
    let totalCosto = 0

    selectedProductIds.forEach(id => {
      const prod = productos.find(p => p.id === id)
      if (!prod) return
      const cantidad = orderQuantities[prod.id] !== undefined ? orderQuantities[prod.id] : getCantidadRecomendada(prod)
      const costo = orderCosts[prod.id] !== undefined ? orderCosts[prod.id] : getCostoDefecto(prod)
      totalItems += cantidad
      totalCosto += cantidad * costo
    })

    selectedManualIds.forEach(id => {
      const item = manualItems.find(m => m.id === id)
      if (!item) return
      totalItems += item.cantidad
      totalCosto += item.cantidad * item.precio_compra
    })

    return { totalItems, totalCosto }
  }, [selectedProductIds, selectedManualIds, productos, manualItems, orderQuantities, orderCosts])

  // --- Selección e Interacción de Ítems ---
  const handleToggleSelectManual = (id: string) => {
    setSelectedManualIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAllFiltered = () => {
    const allFilteredIds = productosFiltrados.map(p => p.id)
    const allSelected = allFilteredIds.every(id => selectedProductIds.includes(id))
    if (allSelected) {
      setSelectedProductIds(prev => prev.filter(id => !allFilteredIds.includes(id)))
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...allFilteredIds])))
    }
  }

  // --- Acciones de base de datos ---

  // 1. Agregar Proveedor
  const handleAddProveedor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formProveedor.nombre.trim()) return
    setCreandoProveedor(true)

    try {
      const res = await fetch('/api/reabastecer/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formProveedor)
      })
      const data = await res.json()
      if (res.ok) {
        setProveedores(prev => [...prev, data].sort((a,b) => a.nombre.localeCompare(b.nombre)))
        setFormProveedor({ nombre: '', telefono: '', contacto: '' })
        showToast('Proveedor agregado con éxito.', 'success')
      } else {
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreandoProveedor(false)
    }
  }

  // 2. Guardar Proforma de Compra
  const handleSaveOrden = async () => {
    const provNombre = activeProveedorNombre
    if (!provNombre) {
      showToast('Debes seleccionar o escribir un proveedor para esta orden.', 'error')
      return
    }

    const items: any[] = []
    
    // Items del catálogo
    selectedProductIds.forEach(id => {
      const prod = productos.find(p => p.id === id)
      if (!prod) return
      items.push({
        producto_id: prod.id,
        nombre: prod.nombre,
        marca: prod.marca || null,
        cantidad: orderQuantities[prod.id] !== undefined ? orderQuantities[prod.id] : getCantidadRecomendada(prod),
        precio_compra: orderCosts[prod.id] !== undefined ? orderCosts[prod.id] : getCostoDefecto(prod),
        unidad: prod.unidad
      })
    })

    // Items manuales
    selectedManualIds.forEach(id => {
      const item = manualItems.find(m => m.id === id)
      if (!item) return
      items.push({
        producto_id: null,
        nombre: item.nombre,
        marca: item.marca || null,
        cantidad: item.cantidad,
        precio_compra: item.precio_compra,
        unidad: item.unidad
      })
    })

    if (items.length === 0) {
      showToast('Debes seleccionar al menos un producto.', 'error')
      return
    }

    setCreandoOrden(true)
    try {
      const res = await fetch('/api/reabastecer/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: selectedProveedorId || null,
          proveedor_nombre: provNombre,
          total: statsNuevaOrden.totalCosto,
          items
        })
      })
      const data = await res.json()
      if (res.ok) {
        setOrdenes(prev => [data, ...prev])
        // Limpiar selección
        setSelectedProductIds([])
        setSelectedManualIds([])
        setOrderQuantities({})
        setOrderCosts({})
        setManualItems([])
        setSelectedProveedorId('')
        setCustomProveedorNombre('')
        showToast('Proforma de compra guardada correctamente.', 'success')
        setActiveTab('lista')
      } else {
        showToast(`Error al guardar: ${data.error}`, 'error')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCreandoOrden(false)
    }
  }

  // 3. Confirmar Entrega (Ingresar stock e inventario)
  const handleRecibirOrden = async (ordenId: string) => {
    if (!confirm('¿Confirmas que el pedido ya llegó y deseas sumar esta mercadería al inventario actual? Los productos que no existían se crearán automáticamente.')) return
    setLoadingActionId(ordenId)

    try {
      const res = await fetch(`/api/reabastecer/ordenes/${ordenId}/recibir`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, estado: 'recibido' } : o))
        
        // Recargar productos desde el servidor para reflejar los nuevos stocks y productos
        const resProd = await fetch('/api/products')
        if (resProd.ok) {
          const freshProds = await resProd.json()
          setProductos(freshProds)
        }
        
        showToast('¡Stock ingresado al inventario con éxito!', 'success')
      } else {
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingActionId(null)
    }
  }

  // 4. Cancelar Orden
  const handleCancelarOrden = async (ordenId: string) => {
    if (!confirm('¿Seguro que deseas cancelar esta orden de compra?')) return
    setLoadingActionId(ordenId)

    try {
      const res = await fetch(`/api/reabastecer/ordenes/${ordenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelado' })
      })
      const data = await res.json()
      if (res.ok) {
        setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, estado: 'cancelado' } : o))
        showToast('Orden cancelada.', 'info')
      } else {
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingActionId(null)
    }
  }

  // 5. Eliminar Orden
  const handleEliminarOrden = async (ordenId: string) => {
    if (!confirm('¿Seguro que quieres eliminar esta proforma de la base de datos? Esta acción es definitiva.')) return
    setLoadingActionId(ordenId)

    try {
      const res = await fetch(`/api/reabastecer/ordenes/${ordenId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setOrdenes(prev => prev.filter(o => o.id !== ordenId))
        showToast('Proforma eliminada.', 'info')
      } else {
        const data = await res.json()
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingActionId(null)
    }
  }

  // 6. Actualización inline de productos
  const handleSaveProductField = async (productId: string, field: 'proveedor' | 'marca', value: string) => {
    setSavingId(productId)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value.trim() || null })
      })
      if (res.ok) {
        setProductos(prev => prev.map(p => p.id === productId ? { ...p, [field]: value.trim() || null } : p))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingId(null)
      setEditProveedorId(null)
      setEditMarcaId(null)
    }
  }

  // --- Agregar Ítem Manual ---
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formManual.nombre.trim()) return

    const newItem: ManualItem = {
      id: `manual_${Date.now()}`,
      nombre: formManual.nombre.trim(),
      marca: formManual.marca.trim(),
      proveedor: activeProveedorNombre,
      proveedorId: selectedProveedorId || undefined,
      cantidad: Number(formManual.cantidad) || 1,
      precio_compra: Number(formManual.precio_compra) || 0,
      unidad: formManual.unidad
    }

    setManualItems(prev => [...prev, newItem])
    setSelectedManualIds(prev => [...prev, newItem.id]) // Seleccionar de inmediato
    
    setFormManual({
      nombre: '',
      marca: '',
      cantidad: 1,
      precio_compra: 0,
      unidad: 'unidad'
    })
    setMostrarFormManual(false)
  }

  // --- Herramientas de Salida y Compartir ---
  const getWhatsAppText = (orden: OrdenCompra) => {
    let text = `📦 *Proforma de Compra - Abastecimiento*\n`
    text += `*Proveedor:* ${orden.proveedor_nombre}\n`
    text += `*Estado:* ${orden.estado.toUpperCase()}\n`
    text += `*Fecha:* ${new Date(orden.created_at).toLocaleDateString()}\n`
    text += `-------------------------------------------\n\n`

    let index = 1
    orden.items?.forEach(item => {
      const marcaStr = item.marca ? ` (${item.marca})` : ''
      text += `${index++}. ${item.cantidad} ${item.unidad}(s) - *${item.nombre}*${marcaStr}\n`
    })

    text += `\n-------------------------------------------\n`
    text += `*Total Estimado:* S/ ${orden.total.toFixed(2)}\n\n`
    text += `Por favor confirmar precios y despacho.`
    return text
  }

  const copyWhatsAppMessage = (orden: OrdenCompra) => {
    const text = getWhatsAppText(orden)
    navigator.clipboard.writeText(text)
    showToast(`Mensaje para "${orden.proveedor_nombre}" copiado al portapapeles.`, 'success')
  }

  const exportExcel = async (orden: OrdenCompra) => {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Orden de Compra')

      // Configurar anchos de columna
      worksheet.getColumn(1).width = 42 // Producto
      worksheet.getColumn(2).width = 18 // Marca
      worksheet.getColumn(3).width = 12 // Cantidad
      worksheet.getColumn(4).width = 12 // Unidad
      worksheet.getColumn(5).width = 18 // Costo Unitario
      worksheet.getColumn(6).width = 18 // Subtotal

      // Título con estética premium
      worksheet.addRow([])
      const titleRow = worksheet.addRow(['PROFORMA DE COMPRA - REABASTECIMIENTO'])
      titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F2937' } }
      worksheet.mergeCells(`A${titleRow.number}:F${titleRow.number}`)
      worksheet.getRow(titleRow.number).height = 30

      // Proveedor y Fecha
      const provRow = worksheet.addRow([`Proveedor: ${orden.proveedor_nombre}`])
      provRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4B5563' } }
      worksheet.mergeCells(`A${provRow.number}:F${provRow.number}`)
      worksheet.getRow(provRow.number).height = 18

      const dateRow = worksheet.addRow([`Fecha de Emisión: ${new Date(orden.created_at).toLocaleDateString()}`])
      dateRow.getCell(1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6B7280' } }
      worksheet.mergeCells(`A${dateRow.number}:F${dateRow.number}`)
      worksheet.getRow(dateRow.number).height = 18

      worksheet.addRow([]) // Fila vacía de separación

      // Encabezados de Tabla
      const headerRow = worksheet.addRow(['Producto', 'Marca', 'Cantidad', 'Unidad', 'Costo Unitario', 'Subtotal'])
      headerRow.height = 25
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1F2937' } // Charcoal
        }
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'medium', color: { argb: 'FF111827' } }
        }
      })

      // Datos de los items
      orden.items?.forEach((item, index) => {
        const sub = item.cantidad * item.precio_compra
        const row = worksheet.addRow([
          item.nombre,
          item.marca || '—',
          item.cantidad,
          item.unidad,
          item.precio_compra,
          sub
        ])
        row.height = 20

        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
        
        row.getCell(5).numFmt = '"S/" #,##0.00'
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }

        row.getCell(6).numFmt = '"S/" #,##0.00'
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }

        // Cebra y Bordes
        const isEven = index % 2 === 1
        row.eachCell((cell) => {
          cell.font = { name: 'Calibri', size: 10 }
          if (isEven) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF9FAFB' }
            }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
        })
      })

      // Fila de Total
      const totalRow = worksheet.addRow(['TOTAL ESTIMADO', '', '', '', '', orden.total])
      worksheet.mergeCells(`A${totalRow.number}:E${totalRow.number}`)
      totalRow.height = 25

      totalRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F2937' } }
      totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }

      totalRow.getCell(6).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E40AF' } }
      totalRow.getCell(6).numFmt = '"S/" #,##0.00'
      totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
      totalRow.getCell(6).border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'double', color: { argb: 'FF1E40AF' } }
      }

      // Escribir y descargar
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `Proforma_Compra_${orden.proveedor_nombre.replace(/\s+/g, '_')}_${orden.id.slice(0, 8)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Error generando excel:', err)
      showToast('Ocurrió un error al generar el archivo Excel.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Sub-navegación premium */}
      <div className="flex border-b border-zinc-100 bg-white p-2.5 rounded-2xl border border-zinc-200/60 shadow-sm gap-2">
        <button
          onClick={() => setActiveTab('lista')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === 'lista'
              ? 'bg-zinc-950 text-white'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Proformas Guardadas
        </button>

        <button
          onClick={() => setActiveTab('nuevo')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === 'nuevo'
              ? 'bg-zinc-950 text-white'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Nueva Proforma
        </button>

        <button
          onClick={() => setActiveTab('proveedores')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition ${
            activeTab === 'proveedores'
              ? 'bg-zinc-950 text-white'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <Building className="w-4 h-4" />
          Proveedores
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA A: HISTORIAL DE PROFORMAS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'lista' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Historial de Reposiciones y Proformas</h3>
              <span className="text-xs text-zinc-400 font-semibold">{ordenes.length} órdenes registradas</span>
            </div>

            {ordenes.length === 0 ? (
              <div className="text-center py-20 text-zinc-400">
                <ClipboardList className="w-12 h-12 mx-auto text-zinc-200 mb-3" />
                <p className="text-sm font-bold text-zinc-600">No hay órdenes registradas aún</p>
                <p className="text-xs text-zinc-400 mt-1">Haz clic en "Nueva Proforma" para armar tu primer pedido de abastecimiento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/30 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      <th className="px-5 py-3.5">Fecha</th>
                      <th className="px-5 py-3.5">Proveedor</th>
                      <th className="px-5 py-3.5 text-center">Ítems</th>
                      <th className="px-5 py-3.5 text-right">Total Estimado</th>
                      <th className="px-5 py-3.5 text-center">Estado</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 text-sm">
                    {ordenes.map(ord => {
                      const countItems = ord.items?.length || 0
                      const isPending = ord.estado === 'pendiente'
                      const isReceived = ord.estado === 'recibido'
                      const isCanceled = ord.estado === 'cancelado'

                      const isActing = loadingActionId === ord.id

                      return (
                        <tr key={ord.id} className="hover:bg-zinc-50/40 transition-colors">
                          <td className="px-5 py-4 text-zinc-600 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                              {new Date(ord.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-zinc-900">
                            {ord.proveedor_nombre}
                            {ord.proveedores?.telefono && (
                              <p className="text-[10px] text-zinc-400 font-normal mt-0.5">Tlf: {ord.proveedores.telefono}</p>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center font-semibold text-zinc-600">
                            {countItems}u
                          </td>
                          <td className="px-5 py-4 text-right font-extrabold text-zinc-950 tabular-nums">
                            {formatPEN(ord.total)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isReceived 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : isCanceled 
                                ? 'bg-red-50 text-red-700 border border-red-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {isReceived ? 'Ingresado (Stock)' : isCanceled ? 'Cancelado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {/* Confirmar stock */}
                              {isPending && (
                                <button
                                  onClick={() => handleRecibirOrden(ord.id)}
                                  disabled={isActing}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                  title="Ingresar productos de esta compra al inventario"
                                >
                                  {isActing ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckSquare className="w-3.5 h-3.5" />
                                  )}
                                  Recibir Stock
                                </button>
                              )}

                              {/* WhatsApp copy */}
                              <button
                                onClick={() => copyWhatsAppMessage(ord)}
                                className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Copiar para WhatsApp"
                              >
                                <Send className="w-4 h-4" />
                              </button>

                              {/* Excel Export */}
                              <button
                                onClick={() => exportExcel(ord)}
                                className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Exportar Excel (.xlsx)"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {/* PDF Download */}
                              <a
                                href={`/api/reabastecer/ordenes/${ord.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Descargar PDF de Orden de Compra"
                              >
                                <FileText className="w-4 h-4" />
                              </a>

                              {/* Cancelar */}
                              {isPending && (
                                <button
                                  onClick={() => handleCancelarOrden(ord.id)}
                                  disabled={isActing}
                                  className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                  title="Cancelar Orden"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}

                              {/* Eliminar (si no está recibido) */}
                              {!isReceived && (
                                <button
                                  onClick={() => handleEliminarOrden(ord.id)}
                                  disabled={isActing}
                                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Eliminar Proforma"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA B: CREADOR DE PROFORMA                                            */}
      {/* ========================================================================= */}
      {activeTab === 'nuevo' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-950 text-white rounded-2xl p-5 relative overflow-hidden">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Items Seleccionados</p>
              <p className="text-3xl font-extrabold tracking-tight mt-1">{statsNuevaOrden.totalItems}</p>
              <p className="text-xs text-zinc-400 mt-2">Productos que formarán el pedido</p>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between shadow-sm">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Costo Estimado de Compra</p>
                <p className="text-3xl font-extrabold text-zinc-900 tracking-tight mt-1 tabular-nums">
                  {formatPEN(statsNuevaOrden.totalCosto)}
                </p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Costo unitario por cantidades especificadas</p>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between shadow-sm">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Proveedor del Pedido</p>
                <p className="text-sm font-bold text-zinc-700 truncate mt-3">
                  {activeProveedorNombre || 'Ninguno seleccionado'}
                </p>
              </div>
              <p className="text-[10px] text-zinc-400 mt-2">Las órdenes se crean asociadas a un distribuidor</p>
            </div>
          </div>

          {/* Configuración del Proveedor y Filtros */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Paso 1: Definir Proveedor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Seleccionar Proveedor Registrado</label>
                <select
                  value={selectedProveedorId}
                  onChange={(e) => {
                    setSelectedProveedorId(e.target.value)
                    setCustomProveedorNombre('')
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition bg-white"
                >
                  <option value="">-- Usar proveedor no registrado / Personalizado --</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              {!selectedProveedorId && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">Nombre de Proveedor Temporal</label>
                  <input
                    value={customProveedorNombre}
                    onChange={(e) => setCustomProveedorNombre(e.target.value)}
                    placeholder="Escribe el nombre del proveedor..."
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-zinc-50 pt-4 flex items-center gap-3 flex-wrap">
              {/* Búsqueda de Catálogo */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar productos en catálogo..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                />
              </div>

              {/* Mostrar todo el catálogo */}
              <button
                onClick={() => setMostrarTodos(!mostrarTodos)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                  mostrarTodos 
                    ? 'border-zinc-950 bg-zinc-950 text-white' 
                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {mostrarTodos ? 'Ver solo alertas' : 'Ver todo el catálogo'}
              </button>

              {/* Agregar producto manual */}
              <button
                onClick={() => setMostrarFormManual(!mostrarFormManual)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 text-xs font-bold transition ml-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Producto Fuera de Catálogo
              </button>
            </div>
          </div>

          {/* Formulario Ítem Manual */}
          {mostrarFormManual && (
            <form onSubmit={handleAddManualItem} className="bg-violet-50/50 border border-violet-100 rounded-2xl p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-violet-100">
                <p className="text-xs font-bold text-violet-950 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  Agregar producto fuera de catálogo a la orden
                </p>
                <button type="button" onClick={() => setMostrarFormManual(false)}>
                  <X className="w-4 h-4 text-violet-500 hover:text-violet-700" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-violet-800 mb-1">Nombre *</label>
                  <input
                    required
                    value={formManual.nombre}
                    onChange={(e) => setFormManual(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Pintura Latex Suprema"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-violet-800 mb-1">Marca</label>
                  <input
                    value={formManual.marca}
                    onChange={(e) => setFormManual(p => ({ ...p, marca: e.target.value }))}
                    placeholder="Ej: Anypsa"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-violet-800 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      value={formManual.cantidad}
                      onChange={(e) => setFormManual(p => ({ ...p, cantidad: parseInt(e.target.value) || 1 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-violet-800 mb-1">Unidad</label>
                    <input
                      value={formManual.unidad}
                      onChange={(e) => setFormManual(p => ({ ...p, unidad: e.target.value }))}
                      placeholder="balde"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-violet-800 mb-1">Costo Unitario (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={formManual.precio_compra}
                    onChange={(e) => setFormManual(p => ({ ...p, precio_compra: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-lg transition"
                  >
                    Añadir Ítem
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Listas e Ítems para seleccionar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tabla de Catálogo (2/3) */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Ítems manuales temporales */}
              {manualItems.length > 0 && (
                <div className="bg-violet-50/25 border border-violet-100 rounded-2xl p-4 space-y-3 shadow-sm">
                  <p className="text-xs font-bold text-violet-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Productos manuales en esta proforma ({manualItems.length})
                  </p>
                  <div className="space-y-2">
                    {manualItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-white border border-violet-100 p-3 rounded-xl shadow-sm">
                        <input
                          type="checkbox"
                          checked={selectedManualIds.includes(item.id)}
                          onChange={() => handleToggleSelectManual(item.id)}
                          className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900">{item.nombre}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {item.marca && <span>Marca: {item.marca} </span>}
                            <span>· Unidad: {item.unidad}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div>
                            <span className="text-zinc-500 font-semibold text-[10px]">CANT</span>
                            <input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1
                                setManualItems(prev => prev.map(m => m.id === item.id ? { ...m, cantidad: val } : m))
                              }}
                              className="w-14 ml-1 px-1 py-0.5 text-center border border-zinc-200 rounded font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-zinc-500 font-semibold text-[10px]">COSTO</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.precio_compra}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setManualItems(prev => prev.map(m => m.id === item.id ? { ...m, precio_compra: val } : m))
                              }}
                              className="w-16 ml-1 px-1 py-0.5 text-right border border-zinc-200 rounded font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setManualItems(prev => prev.filter(m => m.id !== item.id))
                              setSelectedManualIds(prev => prev.filter(id => id !== item.id))
                            }}
                            className="p-1 text-zinc-300 hover:text-red-500 transition"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catálogo de Productos */}
              <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Productos del Catálogo</h3>
                  <button
                    onClick={handleSelectAllFiltered}
                    className="text-xs text-zinc-500 hover:text-zinc-950 font-bold"
                  >
                    {productosFiltrados.every(p => selectedProductIds.includes(p.id)) 
                      ? 'Deseleccionar filtrados' 
                      : 'Seleccionar todos los filtrados'}
                  </button>
                </div>

                {productosFiltrados.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400">
                    <Package className="w-10 h-10 mx-auto text-zinc-200 mb-2" />
                    <p className="text-sm font-medium">No hay productos que coincidan</p>
                    <p className="text-xs text-zinc-400">Prueba cambiando los criterios o agregando productos manuales.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-zinc-50/30 text-zinc-400 uppercase font-semibold">
                          <th className="px-4 py-3 w-8"></th>
                          <th className="px-4 py-3">Producto</th>
                          <th className="px-4 py-3">Proveedor</th>
                          <th className="px-4 py-3">Marca</th>
                          <th className="px-4 py-3 text-right">Stock</th>
                          <th className="px-4 py-3 text-center w-20">Cant</th>
                          <th className="px-4 py-3 text-right w-24">Costo Est</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-sm">
                        {productosFiltrados.map(prod => {
                          const isSelected = selectedProductIds.includes(prod.id)
                          const isOutOfStock = prod.stock === 0 && !prod.venta_sin_stock
                          const isLowStock = prod.stock_minimo !== null && prod.stock <= prod.stock_minimo
                          const isSaving = savingId === prod.id

                          return (
                            <tr key={prod.id} className={`hover:bg-zinc-50/40 transition-colors ${isSelected ? 'bg-zinc-50/20' : ''}`}>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectProduct(prod.id)}
                                  className="rounded border-zinc-300 text-zinc-950 w-4 h-4 focus:ring-zinc-900"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-bold text-zinc-900">{prod.nombre}</p>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">por {prod.unidad}</p>
                                </div>
                              </td>
                              
                              {/* Proveedor inline */}
                              <td className="px-4 py-3">
                                {editProveedorId === prod.id ? (
                                  <input
                                    autoFocus
                                    defaultValue={prod.proveedor || ''}
                                    onBlur={(e) => handleSaveProductField(prod.id, 'proveedor', e.target.value)}
                                    className="px-2 py-0.5 border border-zinc-300 rounded text-xs w-28 bg-white"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveProductField(prod.id, 'proveedor', (e.target as HTMLInputElement).value)
                                      if (e.key === 'Escape') setEditProveedorId(null)
                                    }}
                                  />
                                ) : (
                                  <span
                                    onClick={() => setEditProveedorId(prod.id)}
                                    className={`text-[10px] px-2 py-0.5 rounded cursor-pointer border border-dashed transition ${
                                      prod.proveedor ? 'border-zinc-200 text-zinc-700 hover:border-zinc-400' : 'border-amber-200 text-amber-600 bg-amber-50'
                                    }`}
                                  >
                                    {isSaving && savingId === prod.id ? 'Guardando...' : prod.proveedor || '+ Proveedor'}
                                  </span>
                                )}
                              </td>

                              {/* Marca inline */}
                              <td className="px-4 py-3">
                                {editMarcaId === prod.id ? (
                                  <input
                                    autoFocus
                                    defaultValue={prod.marca || ''}
                                    onBlur={(e) => handleSaveProductField(prod.id, 'marca', e.target.value)}
                                    className="px-2 py-0.5 border border-zinc-300 rounded text-xs w-24 bg-white"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveProductField(prod.id, 'marca', (e.target as HTMLInputElement).value)
                                      if (e.key === 'Escape') setEditMarcaId(null)
                                    }}
                                  />
                                ) : (
                                  <span
                                    onClick={() => setEditMarcaId(prod.id)}
                                    className="text-[10px] px-2 py-0.5 rounded cursor-pointer border border-dashed border-zinc-200 text-zinc-600 hover:border-zinc-400"
                                  >
                                    {isSaving && savingId === prod.id ? '...' : prod.marca || '+ Marca'}
                                  </span>
                                )}
                              </td>

                              {/* Stock */}
                              <td className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end">
                                  <span className={`font-semibold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-zinc-600'}`}>
                                    {prod.stock}
                                  </span>
                                  {isLowStock && (
                                    <span className="text-[8px] font-bold text-amber-500 flex items-center gap-0.5">
                                      <AlertTriangle className="w-2 h-2" /> Stock Bajo
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Cantidad a pedir */}
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  disabled={!isSelected}
                                  value={orderQuantities[prod.id] !== undefined ? orderQuantities[prod.id] : getCantidadRecomendada(prod)}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    setOrderQuantities(p => ({ ...p, [prod.id]: val }))
                                  }}
                                  className={`w-12 text-center py-0.5 rounded border text-xs font-bold ${
                                    isSelected ? 'border-zinc-300 bg-white' : 'border-zinc-100 bg-zinc-50 text-zinc-300'
                                  }`}
                                />
                              </td>

                              {/* Costo a pedir */}
                              <td className="px-4 py-3 text-right">
                                <div className="relative inline-block w-20">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">S/</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    disabled={!isSelected}
                                    value={orderCosts[prod.id] !== undefined ? orderCosts[prod.id] : getCostoDefecto(prod)}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0
                                      setOrderCosts(p => ({ ...p, [prod.id]: val }))
                                    }}
                                    className={`w-full pl-5 pr-1 py-0.5 text-right rounded border text-xs font-bold ${
                                      isSelected ? 'border-zinc-300 bg-white' : 'border-zinc-100 bg-zinc-50 text-zinc-300'
                                    }`}
                                  />
                                </div>
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

            {/* Panel de Resumen Guardar (1/3) */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4 sticky top-6">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider border-b border-zinc-100 pb-2 flex items-center gap-1">
                  <Building className="w-4 h-4 text-zinc-400" />
                  Previsualizar Proforma
                </h4>

                <div className="space-y-3">
                  <div className="text-xs space-y-2">
                    <p className="text-zinc-500 font-semibold">Proveedor:</p>
                    <p className="text-sm font-bold text-zinc-800 bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-100">
                      {activeProveedorNombre || '(Falta definir proveedor)'}
                    </p>
                  </div>

                  <div className="text-xs space-y-1 pt-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Ítems a ordenar:</span>
                      <span className="font-bold text-zinc-700">{statsNuevaOrden.totalItems} unidades</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-zinc-50 text-sm font-bold">
                      <span className="text-zinc-800">Costo total estimado:</span>
                      <span className="text-zinc-950 tabular-nums">{formatPEN(statsNuevaOrden.totalCosto)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveOrden}
                  disabled={creandoOrden || statsNuevaOrden.totalItems === 0 || !activeProveedorNombre}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-950 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 transition shadow-sm"
                >
                  {creandoOrden && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Guardar Proforma en Sistema
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA C: GESTIÓN DE PROVEEDORES                                         */}
      {/* ========================================================================= */}
      {activeTab === 'proveedores' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Listado de Proveedores (2/3) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mis Proveedores Registrados</h3>
              <Badge variant="blue">{proveedores.length}</Badge>
            </div>

            {proveedores.length === 0 ? (
              <div className="text-center py-20 text-zinc-400">
                <Building className="w-12 h-12 mx-auto text-zinc-200 mb-3" />
                <p className="text-sm font-bold text-zinc-600">No hay proveedores registrados</p>
                <p className="text-xs text-zinc-400 mt-1">Registra tu primer proveedor usando el formulario de la derecha.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/30 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      <th className="px-5 py-3">Nombre</th>
                      <th className="px-5 py-3">Contacto</th>
                      <th className="px-5 py-3">Teléfono (WhatsApp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 text-sm">
                    {proveedores.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-50/40 transition">
                        <td className="px-5 py-3.5 font-bold text-zinc-950">{p.nombre}</td>
                        <td className="px-5 py-3.5 text-zinc-600">{p.contacto || '—'}</td>
                        <td className="px-5 py-3.5 text-zinc-600 tabular-nums">
                          {p.telefono ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-zinc-400" />
                              {p.telefono}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Formulario Agregar Proveedor (1/3) */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider border-b border-zinc-100 pb-2 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-zinc-400" />
              Nuevo Proveedor
            </h4>
            <form onSubmit={handleAddProveedor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nombre de la Empresa *</label>
                <input
                  required
                  value={formProveedor.nombre}
                  onChange={(e) => setFormProveedor(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Distribuidora Metalúrgica S.A."
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Contacto Personal</label>
                <input
                  value={formProveedor.contacto}
                  onChange={(e) => setFormProveedor(p => ({ ...p, contacto: e.target.value }))}
                  placeholder="Ej: Ing. Carlos Méndez"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Teléfono (WhatsApp)</label>
                <input
                  value={formProveedor.telefono}
                  onChange={(e) => setFormProveedor(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej: +51 987654321"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition"
                />
              </div>

              <button
                type="submit"
                disabled={creandoProveedor || !formProveedor.nombre.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-950 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 transition shadow-sm"
              >
                {creandoProveedor && <RefreshCw className="w-4 h-4 animate-spin" />}
                Agregar Proveedor
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Toast Notification Premium */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-5 fade-in duration-200 ${
          toast.type === 'success' 
            ? 'bg-emerald-950 text-emerald-50 border-emerald-800' 
            : toast.type === 'error' 
            ? 'bg-red-950 text-red-50 border-red-800' 
            : 'bg-zinc-950 text-zinc-50 border-zinc-800'
        }`}>
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
          {toast.type === 'info' && <Bookmark className="w-4 h-4 text-zinc-400" />}
          <span className="text-xs font-semibold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-white/10 rounded transition">
            <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

    </div>
  )
}
