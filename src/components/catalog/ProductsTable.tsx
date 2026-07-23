'use client'

import { useState, useRef, useEffect, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, ToggleLeft, ToggleRight, Tag, Loader2, TrendingUp, AlertTriangle, Copy, Receipt, Printer, Sparkles } from 'lucide-react'
import { type Producto, type Categoria } from '@/types/database'
import { formatPEN, matchesFuzzy } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import CategoryManager from './CategoryManager'
import DuplicadosPanel from './DuplicadosPanel'
import PrintBarcodeModal from './PrintBarcodeModal'

// Helper para edición en línea
function EditableCell({
  value,
  onSave,
  type = 'text',
  isSaving = false,
  className = ''
}: {
  value: string | number,
  onSave: (val: string | number) => void,
  type?: 'text' | 'number',
  isSaving?: boolean,
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)

  if (editing) {
    return (
      <input
        type={type}
        autoFocus
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={() => {
          setEditing(false)
          const finalVal = type === 'number' ? Number(localValue) : localValue
          if (finalVal !== value && localValue !== '') onSave(finalVal)
          else setLocalValue(value)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') { setLocalValue(value); setEditing(false) }
        }}
        className={`w-full px-1.5 py-0.5 text-sm border-2 border-indigo-500 rounded bg-white shadow-sm focus:outline-none ${className}`}
      />
    )
  }

  return (
    <div
      onClick={() => { setEditing(true); setLocalValue(value) }}
      className={`cursor-pointer hover:bg-zinc-100 px-1.5 py-0.5 -mx-1.5 rounded transition relative group flex items-center min-w-8 ${className}`}
    >
      <span className="whitespace-normal break-words leading-tight">{type === 'number' ? value : value || 'Sin nombre'}</span>
      {isSaving
        ? <Loader2 className="w-3 h-3 animate-spin ml-1 text-indigo-500 shrink-0" />
        : <Pencil className="w-3 h-3 ml-1 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      }
    </div>
  )
}

interface ProductsTableProps {
  productos: Producto[]
  categorias: Categoria[]
  margenMinimo?: number
  igvGlobal?: boolean
  multiSucursal?: boolean
  locales?: any[]
  stockLocales?: any[]
}

export default function ProductsTable({
  productos: initialProductos,
  categorias: initialCategorias,
  margenMinimo = 10,
  igvGlobal = false,
  multiSucursal = false,
  locales = [],
  stockLocales = []
}: ProductsTableProps) {
  const router = useRouter()

  const [productos, setProductos] = useState(initialProductos)
  const [categorias, setCategorias] = useState(initialCategorias)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [soloActivos, setSoloActivos] = useState(false)
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [modalCategorias, setModalCategorias] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [loadingToggle, setLoadingToggle] = useState<string | null>(null)
  const [loadingEliminar, setLoadingEliminar] = useState(false)
  const [modalDuplicados, setModalDuplicados] = useState(false)
  const [modalEtiqueta, setModalEtiqueta] = useState<Producto | null>(null)
  const [expandedVariantes, setExpandedVariantes] = useState<Record<string, boolean>>({})

  const toggleExpandVariantes = (id: string) => {
    setExpandedVariantes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Cuenta pares de nombres idénticos (ignorando tildes/mayúsculas) para colorear el botón
  const numeroDuplicados = useMemo(() => {
    function norm(s: string) {
      return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').trim()
    }
    const usados = new Set<string>()
    let count = 0
    for (let i = 0; i < productos.length; i++) {
      if (usados.has(productos[i].id)) continue
      for (let j = i + 1; j < productos.length; j++) {
        if (usados.has(productos[j].id)) continue
        const na = norm(productos[i].nombre)
        const nb = norm(productos[j].nombre)
        if (na && na === nb) {
          usados.add(productos[i].id)
          usados.add(productos[j].id)
          count++
          break
        }
      }
    }
    return count
  }, [productos])

  const scanBuffer = useRef('')
  const lastKeyTime = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      const now = Date.now()
      if (now - lastKeyTime.current > 50) scanBuffer.current = ''
      lastKeyTime.current = now
      if (e.key === 'Enter' && scanBuffer.current.length >= 3) {
        setBusqueda(scanBuffer.current)
        scanBuffer.current = ''
        if (!isInput) e.preventDefault()
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const [igv, setIgv] = useState(igvGlobal)
  const [savingIgv, setSavingIgv] = useState(false)
  const [savingField, setSavingField] = useState<{ id: string, field: string } | null>(null)

  async function handleInlineEdit(id: string, field: 'nombre' | 'precio_base' | 'stock', newValue: string | number) {
    const product = productos.find(p => p.id === id)
    if (!product || product[field] === newValue) return
    const oldValue = product[field]
    setProductos(prev => prev.map(p => p.id === id ? { ...p, [field]: newValue } : p))
    setSavingField({ id, field })
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setProductos(prev => prev.map(p => p.id === id ? { ...p, [field]: oldValue } : p))
      alert('Error al guardar el cambio.')
    } finally {
      setSavingField(null)
    }
  }

  async function toggleIgv() {
    setSavingIgv(true)
    const nuevo = !igv
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ igv_incluido_en_precios: nuevo }),
    })
    setSavingIgv(false)
    if (res.ok) { setIgv(nuevo); router.refresh() }
  }

  const productosFiltrados = productos.filter((p) => {
    const variantesTexto = p.variantes?.map(v => `${v.nombre_variante} ${v.sku ?? ''}`).join(' ') ?? ''
    const matchBusqueda = matchesFuzzy(`${p.nombre} ${p.descripcion ?? ''} ${p.marca ?? ''} ${p.proveedor ?? ''} ${p.codigo_barras ?? ''} ${p.codigo_interno ?? ''} ${variantesTexto}`, busqueda)
    const matchCategoria = categoriaFiltro === 'todas' || p.categoria_id === categoriaFiltro
    const matchActivo = !soloActivos || p.activo

    const stockEfectivo = p.tiene_variantes && p.variantes && p.variantes.length > 0
      ? p.variantes.reduce((acc, v) => acc + (v.stock || 0), 0)
      : p.stock

    const esBajoStock = p.stock_minimo !== null ? stockEfectivo <= p.stock_minimo : stockEfectivo === 0
    const matchStockBajo = !soloStockBajo || esBajoStock
    return matchBusqueda && matchCategoria && matchActivo && matchStockBajo
  })

  async function toggleActivo(producto: Producto) {
    setLoadingToggle(producto.id)
    const res = await fetch(`/api/products/${producto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !producto.activo }),
    })
    setLoadingToggle(null)
    if (res.ok) setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, activo: !p.activo } : p))
  }

  async function eliminar(id: string) {
    setLoadingEliminar(true)
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setLoadingEliminar(false)
    if (res.ok) { setProductos(prev => prev.filter(p => p.id !== id)); setConfirmEliminar(null) }
  }

  function handleMerge(conservarId: string, eliminarId: string, stockNuevo: number, accion: string) {
    setProductos(prev => {
      const sinEliminado = prev.filter(p => p.id !== eliminarId)
      if (!conservarId) return sinEliminado
      return sinEliminado.map(p =>
        p.id === conservarId ? { ...p, stock: stockNuevo, activo: accion === 'desactivado' ? p.activo : true } : p
      )
    })
  }

  function getNombreCategoria(categoriaId: string | null) {
    if (!categoriaId) return null
    return categorias.find(c => c.id === categoriaId)?.nombre ?? null
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="flex-1 min-w-48 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition"
        />
        <select
          value={categoriaFiltro}
          onChange={e => setCategoriaFiltro(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300 transition bg-white"
        >
          <option value="todas">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-300" />
          Solo activos
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
          <input type="checkbox" checked={soloStockBajo} onChange={e => setSoloStockBajo(e.target.checked)} className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900" />
          <span className={soloStockBajo ? 'font-medium text-zinc-900' : ''}>Stock bajo</span>
        </label>
        <button onClick={() => setModalCategorias(true)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition font-medium">
          <Tag className="w-3.5 h-3.5" /> Categorías
        </button>
        <button
          onClick={() => setModalDuplicados(true)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition font-medium ${
            numeroDuplicados > 0
              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicados
          {numeroDuplicados > 0 && (
            <span className="ml-0.5 text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full leading-none">
              {numeroDuplicados}
            </span>
          )}
        </button>
        <button
          onClick={toggleIgv}
          disabled={savingIgv}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition font-medium disabled:opacity-50"
        >
          {savingIgv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
          <span>IGV</span>
          <span className={`w-8 h-4 rounded-full transition relative ${igv ? 'bg-zinc-900' : 'bg-zinc-300'}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${igv ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>
      </div>

      <p className="text-xs text-zinc-400">
        {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
        {busqueda || categoriaFiltro !== 'todas' ? ' encontrados' : ' en total'}
      </p>

      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-medium text-zinc-500 mb-1">Sin productos</p>
          <p className="text-sm text-zinc-400">
            {busqueda ? 'No hay productos que coincidan con la búsqueda.' : 'Agrega tu primer producto usando el botón de arriba.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── VISTA MOBILE: TARJETAS ── */}
          <div className="md:hidden space-y-3">
            {productosFiltrados.map((producto) => {
              const isOutOfStock = producto.stock === 0 && !producto.venta_sin_stock
              const isLowStock = producto.stock_minimo !== null && producto.stock <= producto.stock_minimo
              const nombreCat = getNombreCategoria(producto.categoria_id)
              return (
                <div key={producto.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                  <div className="flex items-start justify-between p-4 pb-3">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-lg shrink-0" title="Código Interno">{producto.codigo_interno}</span>
                        <span className="font-bold text-zinc-900 text-base leading-tight">{producto.nombre}</span>
                        <button onClick={() => toggleActivo(producto)} disabled={loadingToggle === producto.id} className="shrink-0">
                          {loadingToggle === producto.id
                            ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            : producto.activo
                              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                              : <ToggleLeft className="w-5 h-5 text-zinc-300" />
                          }
                        </button>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {nombreCat && <Badge variant="blue">{nombreCat}</Badge>}
                        {producto.marca && <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full">{producto.marca}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setModalEtiqueta(producto)}
                        className="p-2.5 bg-zinc-50 text-zinc-500 hover:bg-zinc-900 hover:text-white rounded-xl transition"
                        title="Imprimir etiqueta"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <Link
                        href={`/dashboard/catalog/${producto.id}`}
                        className="p-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 transition"
                        title="Editar producto"
                      >
                        <Pencil className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-zinc-100 border-t border-zinc-100">
                    <div className="p-3 text-center">
                      <p className="text-[10px] text-zinc-400 uppercase font-semibold mb-0.5">Precio</p>
                      <p className="font-bold text-zinc-900 tabular-nums text-sm">{formatPEN(producto.precio_base)}</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] text-zinc-400 uppercase font-semibold mb-0.5">Stock</p>
                      <p className={`font-bold tabular-nums text-sm ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-600' : 'text-zinc-900'}`}>
                        {producto.stock}
                        {isOutOfStock && <span className="block text-[9px] font-semibold text-red-400">Agotado</span>}
                        {!isOutOfStock && isLowStock && <span className="block text-[9px] font-semibold text-amber-500">Stock bajo</span>}
                      </p>
                      {multiSucursal && (
                        <div className="mt-1 flex flex-col items-center gap-0.5">
                          {locales.map(loc => {
                            const stockLocal = stockLocales.find(sl => sl.local_id === loc.id && sl.producto_id === producto.id)?.stock || 0
                            return (
                              <span key={loc.id} className="text-[9px] text-zinc-500 font-medium whitespace-nowrap">
                                {loc.nombre}: <b className="text-zinc-700">{stockLocal}</b>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] text-zinc-400 uppercase font-semibold mb-0.5">Unidad</p>
                      <p className="font-medium text-zinc-700 text-sm">{producto.unidad}</p>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-2">
                    {producto.codigo_barras ? (
                      <span className="font-mono text-xs text-zinc-600 bg-white border border-zinc-200 px-2 py-1 rounded-lg truncate max-w-[200px]">
                        {producto.codigo_barras}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 italic">Sin código de barras</span>
                    )}
                    <Link
                      href={`/dashboard/catalog/${producto.id}`}
                      className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition shrink-0"
                    >
                      {producto.codigo_barras ? 'Cambiar código' : '+ Asignar código'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── VISTA DESKTOP: TABLA ── */}
          <div className="hidden md:block bg-white rounded-2xl border border-zinc-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider w-28">Código</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Producto</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Categoría</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Precio</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Ganancia</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Stock</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Descuentos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {productosFiltrados.map((producto) => (
                  <Fragment key={producto.id}>
                    <tr className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500 font-semibold select-all">
                        <span
                          className="bg-zinc-50 border border-zinc-100 px-2 py-1 rounded-lg hover:bg-zinc-100 transition cursor-pointer flex items-center gap-1.5 w-fit"
                          title="Click para copiar"
                          onClick={() => {
                            navigator.clipboard.writeText(producto.codigo_interno)
                          }}
                        >
                          {producto.codigo_interno}
                          <Copy className="w-3 h-3 text-zinc-400 shrink-0" />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <EditableCell
                              value={producto.nombre || ''}
                              type="text"
                              onSave={val => handleInlineEdit(producto.id, 'nombre', val)}
                              isSaving={savingField?.id === producto.id && savingField?.field === 'nombre'}
                              className="font-semibold text-zinc-900 min-w-[120px] max-w-sm"
                            />
                            {producto.marca && <span className="text-[9px] font-medium bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full">{producto.marca}</span>}
                            {producto.proveedor && <span className="text-[9px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-full">Prov: {producto.proveedor}</span>}
                          </div>
                          {producto.descripcion && <p className="text-xs text-zinc-400 mt-0.5 whitespace-normal break-words max-w-sm">{producto.descripcion}</p>}
                          <p className="text-xs text-zinc-400 mt-0.5">por {producto.unidad}</p>
                          {producto.tiene_variantes && producto.variantes && producto.variantes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpandVariantes(producto.id)}
                              className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200/60 px-2 py-0.5 rounded-full transition w-fit"
                            >
                              <Sparkles className="w-3 h-3 text-orange-500" />
                              {producto.variantes.length} variante{producto.variantes.length !== 1 ? 's' : ''} {expandedVariantes[producto.id] ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getNombreCategoria(producto.categoria_id)
                          ? <Badge variant="blue">{getNombreCategoria(producto.categoria_id)}</Badge>
                          : <span className="text-xs text-zinc-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end">
                          <EditableCell
                            value={producto.precio_base}
                            type="number"
                            onSave={val => handleInlineEdit(producto.id, 'precio_base', val)}
                            isSaving={savingField?.id === producto.id && savingField?.field === 'precio_base'}
                            className="font-bold text-zinc-900 tabular-nums text-right w-24"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-0.5 flex-wrap">
                          {igv && producto.afecto_igv && <span className="text-[9px] font-semibold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">c/IGV</span>}
                          {igv && !producto.afecto_igv && <span className="text-[9px] font-semibold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">exonerado</span>}
                          {producto.modo_negociacion && <span className="text-[9px] font-semibold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">negociable</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {producto.precio_compra > 0 ? (() => {
                          const conIgv = igv && producto.afecto_igv
                          const precioNeto = conIgv ? producto.precio_base / 1.18 : producto.precio_base
                          const costoNeto = conIgv ? producto.precio_compra / 1.18 : producto.precio_compra
                          const utilidad = precioNeto - costoNeto
                          const margen = precioNeto > 0 ? (utilidad / precioNeto) * 100 : 0
                          const bajo = margen < margenMinimo
                          return (
                            <div>
                              <div className={`flex items-center justify-end gap-1 text-sm font-semibold tabular-nums ${bajo ? 'text-red-500' : 'text-emerald-600'}`}>
                                {bajo ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <TrendingUp className="w-3.5 h-3.5 shrink-0" />}
                                {formatPEN(utilidad)}
                                <span className="text-xs font-normal opacity-60">({margen.toFixed(0)}%)</span>
                              </div>
                              {conIgv && <p className="text-[9px] text-zinc-400 mt-0.5 text-right">sobre precio neto s/IGV</p>}
                            </div>
                          )
                        })() : <span className="text-xs text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const stockEfectivo = producto.tiene_variantes && producto.variantes && producto.variantes.length > 0
                            ? producto.variantes.reduce((sum, v) => sum + (v.stock || 0), 0)
                            : producto.stock

                          const isOutOfStock = stockEfectivo === 0 && !producto.venta_sin_stock
                          const isLowStock = producto.stock_minimo !== null && stockEfectivo <= producto.stock_minimo
                          const colorClass = isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-600' : 'text-zinc-700'
                          return (
                            <div className="flex flex-col items-end">
                              <div className={`text-sm font-semibold tabular-nums flex justify-end ${colorClass}`}>
                                {producto.tiene_variantes ? (
                                  <span className="font-bold text-zinc-900">{stockEfectivo}</span>
                                ) : (
                                  <EditableCell
                                    value={producto.stock}
                                    type="number"
                                    onSave={val => handleInlineEdit(producto.id, 'stock', val)}
                                    isSaving={savingField?.id === producto.id && savingField?.field === 'stock'}
                                    className="text-right w-16"
                                  />
                                )}
                              </div>
                              {producto.stock_minimo !== null && <span className="text-[9px] text-zinc-400 font-normal">mín. {producto.stock_minimo}</span>}
                              {isOutOfStock && <span className="text-[9px] font-semibold text-red-500 flex items-center gap-0.5 mt-0.5"><AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Agotado</span>}
                              {!isOutOfStock && isLowStock && <span className="text-[9px] font-semibold text-amber-600 flex items-center gap-0.5 mt-0.5"><AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Stock bajo</span>}
                              {multiSucursal && (
                                <div className="mt-1.5 pt-1.5 border-t border-zinc-100/50 flex flex-col items-end gap-0.5 w-full">
                                  {locales.map(loc => {
                                    const stockLocal = stockLocales.find(sl => sl.local_id === loc.id && sl.producto_id === producto.id)?.stock || 0
                                    return (
                                      <span key={loc.id} className="text-[9px] text-zinc-500 font-medium whitespace-nowrap">
                                        {loc.nombre}: <b className="text-zinc-700">{stockLocal}</b>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleActivo(producto)} disabled={loadingToggle === producto.id} className="text-zinc-400 hover:text-zinc-600 transition">
                          {loadingToggle === producto.id
                            ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            : producto.activo
                              ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                              : <ToggleLeft className="w-6 h-6 text-zinc-300" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {producto.reglas_descuento && producto.reglas_descuento.length > 0
                          ? <Badge variant="orange">{producto.reglas_descuento.length} rango{producto.reglas_descuento.length !== 1 ? 's' : ''}</Badge>
                          : <span className="text-xs text-zinc-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setModalEtiqueta(producto)} title="Imprimir etiquetas" className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition">
                            <Printer className="w-4 h-4" />
                          </button>
                          <Link href={`/dashboard/catalog/${producto.id}`} className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition">
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button onClick={() => setConfirmEliminar(producto.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedVariantes[producto.id] && producto.variantes && (
                      <tr key={`var-${producto.id}`} className="bg-orange-50/20">
                        <td colSpan={9} className="px-6 py-3">
                          <div className="p-3 bg-white border border-orange-200/80 rounded-xl shadow-xs space-y-2">
                            <h5 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                              Variantes de {producto.nombre}
                            </h5>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-zinc-100 text-zinc-400 font-semibold text-left">
                                    <th className="py-1 px-2">Variante</th>
                                    <th className="py-1 px-2">SKU</th>
                                    <th className="py-1 px-2 text-right">Precio</th>
                                    <th className="py-1 px-2 text-right">Stock</th>
                                    <th className="py-1 px-2 text-center">Estado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-50">
                                  {producto.variantes.map((v) => (
                                    <tr key={v.id}>
                                      <td className="py-1.5 px-2 font-medium text-zinc-900">{v.nombre_variante}</td>
                                      <td className="py-1.5 px-2 text-zinc-500 font-mono">{v.sku || '—'}</td>
                                      <td className="py-1.5 px-2 text-right font-bold text-zinc-900">
                                        {formatPEN(v.precio ?? producto.precio_base)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold text-zinc-900">{v.stock}</td>
                                      <td className="py-1.5 px-2 text-center">
                                        <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${v.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                                          {v.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modalCategorias} onClose={() => setModalCategorias(false)} title="Gestionar categorías" size="sm">
        <CategoryManager categorias={categorias} onChange={setCategorias} />
      </Modal>

      <Modal open={modalDuplicados} onClose={() => setModalDuplicados(false)} title="Detectar y fusionar duplicados" size="lg">
        <DuplicadosPanel productos={productos} onMerge={handleMerge} onClose={() => setModalDuplicados(false)} />
      </Modal>

      <ConfirmDialog
        open={!!confirmEliminar}
        onClose={() => setConfirmEliminar(null)}
        onConfirm={() => confirmEliminar && eliminar(confirmEliminar)}
        title="Eliminar producto"
        description="¿Seguro que quieres eliminar este producto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={loadingEliminar}
        danger
      />

      {modalEtiqueta && (
        <PrintBarcodeModal producto={modalEtiqueta} onClose={() => setModalEtiqueta(null)} />
      )}
    </div>
  )
}
