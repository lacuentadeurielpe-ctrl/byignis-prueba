'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn, matchesFuzzy } from '@/lib/utils'
import { X, Plus, Trash2, Search, Loader2, Package, Check, CalendarClock, ScanLine, Clock } from 'lucide-react'
import ScannerModal from '@/components/ui/ScannerModal'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { formatearETADesdeISO } from '@/lib/delivery/eta-simple'

interface Producto {
  id: string
  nombre: string
  unidad: string
  precio_base: number
  precio_compra: number
  stock: number
  codigo_barras?: string | null
  tiene_variantes?: boolean
  variantes?: any[]
}

interface Zona {
  id: string
  nombre: string
  tiempo_estimado_min: number
}

interface ItemNuevoPedido {
  producto_id?: string
  variante_id?: string
  nombre_producto: string
  nombre_variante?: string
  cantidad: number
  precio_unitario: number
  unidad: string
  tipo: 'catalogo' | 'manual'
}

interface NuevoPedidoModalProps {
  productos: Producto[]
  zonas: Zona[]
  onClose: () => void
  onPedidoCreado?: (pedido: any) => void
}

export default function NuevoPedidoModal({ productos, zonas, onClose, onPedidoCreado }: NuevoPedidoModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<ItemNuevoPedido[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [itemManual, setItemManual] = useState({ nombre: '', unidad: 'und', cantidad: 1, precio: 0 })
  const [modoManual, setModoManual] = useState(false)
  const busquedaRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busquedaDelay, setBusquedaDelay] = useState('')
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setBusquedaDelay(busqueda), 150)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  const [nombreCliente, setNombreCliente] = useState('')
  const [telefonoCliente, setTelefonoCliente] = useState('')
  const [modalidad, setModalidad] = useState<'delivery' | 'recojo'>('recojo')
  const [direccion, setDireccion] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [notas, setNotas] = useState('')

  const [estadoInicial, setEstadoInicial] = useState<'pendiente' | 'confirmado'>('confirmado')

  const [etaPreview, setEtaPreview] = useState<{
    etaMinutos: number
    distanciaKm: number
    confidence: number
    source: string
    coordsCliente?: { lat: number; lng: number }
    direccionResuelta?: string | null
  } | null>(null)
  const [etaLoading, setEtaLoading] = useState(false)
  const [etaError, setEtaError] = useState<string | null>(null)
  const [showMapPopover, setShowMapPopover] = useState(false)
  const etaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [esProgramado, setEsProgramado] = useState(false)
  const [fechaProgramada, setFechaProgramada] = useState('')
  const scanBuffer = useRef('')
  const lastKeyTime = useRef(0)

  function reproducirBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch (e) {}
  }

  function handleScanCode(codigo: string) {
    for (const prod of productos) {
      if (prod.tiene_variantes && prod.variantes) {
        const varianteExacta = prod.variantes.find(v => v.codigo_barras === codigo)
        if (varianteExacta) {
          agregarProductoConVariante(prod, varianteExacta)
          setMostrarSugerencias(false)
          reproducirBeep()
          return
        }
      }
    }

    const p = productos.find(x => x.codigo_barras === codigo && !x.tiene_variantes)
    if (p) {
      agregarProducto(p)
      setMostrarSugerencias(false)
      reproducirBeep()
    } else {
      toast.error(`Código no encontrado o pertenece a producto con variantes: ${codigo}`)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      if (now - lastKeyTime.current > 100) {
        scanBuffer.current = ''
      }
      lastKeyTime.current = now

      if (e.key === 'Enter' && scanBuffer.current.length >= 4) {
        handleScanCode(scanBuffer.current)
        scanBuffer.current = ''
        e.preventDefault()
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [productos])

  const fetchEtaPreview = useCallback(async (dir: string, zona: string) => {
    if (dir.trim().length < 8) { setEtaPreview(null); setEtaError(null); return }
    setEtaLoading(true)
    setEtaError(null)
    try {
      const res = await fetch('/api/delivery/intelligence/eta-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion: dir.trim(), zona_delivery_id: zona || null }),
      })
      if (res.ok) {
        const data = await res.json()
        setEtaPreview(data)
        setEtaError(null)
        setShowMapPopover(false)
      } else {
        const body = await res.json().catch(() => ({}))
        setEtaPreview(null)
        setEtaError(body.error ?? 'No se pudo calcular el ETA')
      }
    } catch {
      setEtaPreview(null)
      setEtaError('Error de conexión')
    } finally {
      setEtaLoading(false)
    }
  }, [])

  useEffect(() => {
    if (modalidad !== 'delivery') { setEtaPreview(null); setEtaError(null); return }
    if (etaDebounceRef.current) clearTimeout(etaDebounceRef.current)
    if (direccion.trim().length < 8) { setEtaPreview(null); setEtaError(null); setEtaLoading(false); return }
    setEtaLoading(true)
    setEtaError(null)
    etaDebounceRef.current = setTimeout(() => {
      fetchEtaPreview(direccion, zonaId)
    }, 800)
    return () => { if (etaDebounceRef.current) clearTimeout(etaDebounceRef.current) }
  }, [direccion, zonaId, modalidad, fetchEtaPreview])

  const minFechaProgramada = (() => {
    const d = new Date(Date.now() + 30 * 60_000)
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sugerencias = useMemo(() => {
    const q = busquedaDelay.trim()
    if (q.length < 1) return []
    return productos.filter((p) => matchesFuzzy(p.nombre, q) && p.stock > 0).slice(0, 8)
  }, [busquedaDelay, productos])

  const total = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)

  function agregarProducto(p: Producto) {
    const existe = items.findIndex((i) => i.producto_id === p.id && !i.variante_id)
    if (existe >= 0) {
      setItems((prev) => prev.map((i, idx) => idx === existe ? { ...i, cantidad: i.cantidad + 1 } : i))
    } else {
      setItems((prev) => [
        {
          producto_id: p.id,
          nombre_producto: p.nombre,
          cantidad: 1,
          precio_unitario: p.precio_base,
          unidad: p.unidad || 'und',
          tipo: 'catalogo',
        },
        ...prev,
      ])
    }
    setBusqueda('')
    setMostrarSugerencias(false)
    busquedaRef.current?.focus()
  }

  function agregarProductoConVariante(p: Producto, v: any) {
    const existe = items.findIndex((i) => i.producto_id === p.id && i.variante_id === v.id)
    if (existe >= 0) {
      setItems((prev) => prev.map((i, idx) => idx === existe ? { ...i, cantidad: i.cantidad + 1 } : i))
    } else {
      setItems((prev) => [
        {
          producto_id: p.id,
          variante_id: v.id,
          nombre_producto: p.nombre,
          nombre_variante: v.nombre_variante,
          cantidad: 1,
          precio_unitario: v.precio ?? p.precio_base,
          unidad: p.unidad || 'und',
          tipo: 'catalogo',
        },
        ...prev,
      ])
    }
    setBusqueda('')
    setMostrarSugerencias(false)
    busquedaRef.current?.focus()
  }

  function agregarManual() {
    if (!itemManual.nombre.trim() || itemManual.precio <= 0) return
    setItems((prev) => [...prev, {
      producto_id: undefined,
      nombre_producto: itemManual.nombre.trim(),
      unidad: itemManual.unidad.trim() || 'und',
      cantidad: itemManual.cantidad,
      precio_unitario: itemManual.precio,
      tipo: 'manual',
    }])
    setItemManual({ nombre: '', unidad: 'und', cantidad: 1, precio: 0 })
    setModoManual(false)
  }

  function actualizarItem(idx: number, campo: 'cantidad' | 'precio_unitario', valor: number) {
    setItems((prev) => prev.map((i, n) => n === idx ? { ...i, [campo]: valor } : i))
  }

  function eliminarItem(idx: number) {
    setItems((prev) => prev.filter((_, n) => n !== idx))
  }

  async function guardar() {
    if (!items.length) { setError('Agrega al menos un producto'); return }
    if (!nombreCliente.trim()) { setError('El nombre del cliente es obligatorio'); return }
    if (!telefonoCliente.trim()) { setError('El teléfono del cliente es obligatorio'); return }
    if (modalidad === 'delivery' && !direccion.trim()) { setError('La dirección es obligatoria para delivery'); return }
    if (esProgramado && !fechaProgramada) { setError('Indica la fecha y hora de entrega programada'); return }

    // Convertir fecha Lima → ISO UTC para almacenamiento
    let fechaUtc: string | undefined
    if (esProgramado && fechaProgramada) {
      const d = new Date(`${fechaProgramada}:00-05:00`)   // Lima = UTC-5
      if (isNaN(d.getTime())) {
        setError('Fecha de entrega inválida')
        return
      }
      fechaUtc = d.toISOString()
    }

    setGuardando(true)
    setError(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_cliente: nombreCliente.trim(),
          telefono_cliente: telefonoCliente.trim(),
          modalidad,
          direccion_entrega: modalidad === 'delivery' ? direccion.trim() : undefined,
          zona_delivery_id: modalidad === 'delivery' && zonaId ? zonaId : undefined,
          notas: notas.trim() || undefined,
          items,
          fecha_entrega_programada: fechaUtc,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al crear pedido')
      }

      const pedidoCreado = await res.json()
      const pedidoId = pedidoCreado.id

      // Mostrar ETA de entrega propuesto (lo que verá el cliente)
      if (modalidad === 'delivery') {
        const eta = formatearETADesdeISO(pedidoCreado.eta_timestamp)
        toast.success(eta ? `Pedido creado · Entrega ~${eta}` : 'Pedido creado')
      }

      // Si el dueño lo crea como confirmado Y no es programado, disparar comprobante
      if (estadoInicial === 'confirmado' && !esProgramado) {
        await fetch(`/api/orders/${pedidoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'confirmado' }),
        })
      }

      // Llamar callback para agregar el pedido a la lista sin recargar
      if (onPedidoCreado) {
        onPedidoCreado(pedidoCreado)
      } else {
        // Fallback si no se proporciona callback
        router.refresh()
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGuardando(false)
    }
  }

  // Cerrar sugerencias y map popover al hacer click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-busqueda]')) setMostrarSugerencias(false)
      if (!target.closest('[data-eta-popover]')) setShowMapPopover(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Nuevo pedido manual</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sin conversación WhatsApp — pedido directo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── SECCIÓN: PRODUCTOS ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Productos</h3>
              <button
                type="button"
                onClick={() => setModoManual((v) => !v)}
                className="text-xs text-orange-600 hover:text-orange-700 transition"
              >
                {modoManual ? 'Buscar en catálogo' : '+ Producto personalizado'}
              </button>
            </div>

            {/* Buscador de catálogo */}
            {!modoManual && (
              <div className="relative flex gap-2 items-start" data-busqueda>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={busquedaRef}
                    value={busqueda}
                    onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true) }}
                    onFocus={() => busqueda && setMostrarSugerencias(true)}
                    placeholder="Buscar producto del catálogo…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                  />
                  {mostrarSugerencias && sugerencias.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                      {sugerencias.map((p) => (
                        <div key={p.id}>
                          <button
                            type="button"
                            onMouseDown={() => {
                              if (p.tiene_variantes && p.variantes && p.variantes.length > 0) {
                                setExpandedProductId(prev => prev === p.id ? null : p.id)
                              } else {
                                agregarProducto(p)
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 transition text-left ${expandedProductId === p.id ? 'bg-orange-50 border-b border-orange-100' : 'hover:bg-orange-50'}`}
                          >
                            <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                              <Package className="w-3.5 h-3.5 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                                  {p.tiene_variantes && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold shrink-0">
                                      Variantes
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">S/{p.precio_base.toFixed(2)} / {p.unidad} · stk: {p.stock}</p>
                              </div>
                            </div>
                          </button>

                          <AnimatePresence>
                            {expandedProductId === p.id && p.variantes && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-2 ml-10 mt-1 mb-2 bg-white border border-gray-100 rounded-xl shadow-sm space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Selecciona una opción</p>
                                  {p.variantes.map(v => (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onMouseDown={() => agregarProductoConVariante(p, v)}
                                      disabled={v.stock === 0}
                                      className={`w-full flex items-center gap-2 p-2 rounded-lg border transition text-left ${v.stock === 0 ? "opacity-50 border-transparent bg-gray-50 cursor-not-allowed" : "hover:bg-gray-50 border-transparent hover:border-gray-200 cursor-pointer"}`}
                                    >
                                      {v.imagen_url ? (
                                        <img src={v.imagen_url} alt={v.nombre_variante} className="w-6 h-6 rounded object-cover shrink-0 border border-gray-200" />
                                      ) : (
                                        <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                          <Package className="w-3 h-3 text-gray-400" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <h5 className="font-semibold text-xs text-gray-800 truncate">{v.nombre_variante}</h5>
                                        <p className="text-[10px] text-gray-500">Stk: {v.stock}</p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="font-bold text-xs text-gray-900">
                                          S/{(v.precio ?? p.precio_base).toFixed(2)}
                                        </p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                  {mostrarSugerencias && busqueda.trim().length >= 1 && sugerencias.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                      Sin resultados. Usa "Producto personalizado" para añadir uno libre.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="flex items-center justify-center w-[42px] h-[42px] shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                  title="Escanear con cámara"
                >
                  <ScanLine className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Producto manual */}
            {modoManual && (
              <div className="bg-orange-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input
                      value={itemManual.nombre}
                      onChange={(e) => setItemManual((p) => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre del producto"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition bg-white"
                    />
                  </div>
                  <input
                    value={itemManual.unidad}
                    onChange={(e) => setItemManual((p) => ({ ...p, unidad: e.target.value }))}
                    placeholder="Unidad (und, m, kg…)"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition bg-white"
                  />
                  <input
                    type="number"
                    value={itemManual.precio || ''}
                    onChange={(e) => setItemManual((p) => ({ ...p, precio: parseFloat(e.target.value) || 0 }))}
                    placeholder="Precio S/"
                    min={0}
                    step={0.01}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={itemManual.cantidad}
                    onChange={(e) => setItemManual((p) => ({ ...p, cantidad: parseInt(e.target.value) || 1 }))}
                    min={1}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition bg-white"
                  />
                  <span className="text-sm text-gray-500 flex-1">unidades</span>
                  <button
                    type="button"
                    onClick={agregarManual}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de items */}
            {items.length > 0 && (
              <div className="mt-3 space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.nombre_producto}
                        {item.nombre_variante && <span className="text-gray-500 font-normal ml-1">({item.nombre_variante})</span>}
                      </p>
                      <p className="text-xs text-gray-400">{item.unidad}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(idx, 'cantidad', parseInt(e.target.value) || 1)}
                        min={1}
                        className="w-14 px-2 py-1 border border-gray-200 rounded text-sm text-gray-900 text-center bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                      <span className="text-gray-400 text-xs">×</span>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                        <input
                          type="number"
                          value={item.precio_unitario}
                          onChange={(e) => actualizarItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          min={0}
                          step={0.01}
                          className="w-20 pl-6 pr-2 py-1 border border-gray-200 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-16 text-right">
                        S/{(item.cantidad * item.precio_unitario).toFixed(2)}
                      </span>
                    </div>
                    <button onClick={() => eliminarItem(idx)} className="text-gray-400 hover:text-red-500 transition ml-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <span className="text-sm font-bold text-gray-900">
                    Total: S/{total.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── SECCIÓN: CLIENTE ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos del cliente</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono <span className="text-red-500">*</span></label>
                <input
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                  placeholder="51987654321"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                />
              </div>
            </div>
          </div>

          {/* ── SECCIÓN: ENTREGA ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Modalidad de entrega</h3>
            <div className="flex gap-2 mb-4">
              {(['recojo', 'delivery'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModalidad(m)}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-medium transition border',
                    modalidad === m
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                  )}
                >
                  {m === 'recojo' ? 'Recojo en tienda' : 'Delivery'}
                </button>
              ))}
            </div>

            {modalidad === 'delivery' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dirección de entrega <span className="text-red-500">*</span></label>
                  <input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Jr. Los Ferreros 123, Miraflores"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
                  />
                  {/* ETA Preview badge + Map Popover */}
                  <div className="mt-1.5 min-h-6 flex items-center relative" data-eta-popover>
                    {etaLoading && (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Calculando ETA...
                      </span>
                    )}
                    {!etaLoading && etaPreview && (
                      <button
                        type="button"
                        onClick={() => setShowMapPopover(v => !v)}
                        className={cn(
                          'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition hover:brightness-95 active:scale-95',
                          etaPreview.source === 'google'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : etaPreview.source === 'zone_avg'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        )}
                      >
                        <Clock className="w-3 h-3" />
                        ~{etaPreview.etaMinutos} min · {etaPreview.distanciaKm} km
                        <span className="opacity-60">
                          {etaPreview.source === 'google' ? '· Google' : etaPreview.source === 'zone_avg' ? '· Historial IA' : '· Estimado'}
                        </span>
                        <span className="opacity-40 ml-0.5">📍</span>
                      </button>
                    )}
                    {!etaLoading && !etaPreview && etaError && (
                      <span className="text-xs text-amber-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {etaError}
                      </span>
                    )}

                    {/* Map Popover */}
                    {showMapPopover && etaPreview?.coordsCliente && (
                      <div className="absolute top-8 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-72">
                        {/* Static map */}
                        <div className="relative">
                          {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                            <img
                              src={`https://maps.googleapis.com/maps/api/staticmap?center=${etaPreview.coordsCliente.lat},${etaPreview.coordsCliente.lng}&zoom=16&size=560x240&scale=2&markers=color:red%7C${etaPreview.coordsCliente.lat},${etaPreview.coordsCliente.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&style=feature:poi|visibility:off`}
                              alt="Ubicación del cliente"
                              className="w-full h-36 object-cover"
                            />
                          ) : (
                            <iframe
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${etaPreview.coordsCliente.lng - 0.005},${etaPreview.coordsCliente.lat - 0.005},${etaPreview.coordsCliente.lng + 0.005},${etaPreview.coordsCliente.lat + 0.005}&layer=mapnik&marker=${etaPreview.coordsCliente.lat},${etaPreview.coordsCliente.lng}`}
                              className="w-full h-36 border-0"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setShowMapPopover(false)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow text-gray-500 hover:text-gray-700 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Address info */}
                        <div className="px-3 py-2.5">
                          <p className="text-xs font-medium text-gray-800 leading-snug">
                            {etaPreview.direccionResuelta ?? direccion}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {etaPreview.coordsCliente.lat.toFixed(5)}, {etaPreview.coordsCliente.lng.toFixed(5)}
                          </p>
                          <a
                            href={`https://www.google.com/maps?q=${etaPreview.coordsCliente.lat},${etaPreview.coordsCliente.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                          >
                            <span>Abrir en Google Maps</span>
                            <span>↗</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {zonas.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Zona de delivery</label>
                    <select
                      value={zonaId}
                      onChange={(e) => setZonaId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition bg-white"
                    >
                      <option value="">Sin zona específica</option>
                      {zonas.map((z) => (
                        <option key={z.id} value={z.id}>{z.nombre} ({z.tiempo_estimado_min} min)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── NOTAS ── */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notas internas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones, instrucciones especiales…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition resize-none"
            />
          </div>

          {/* ── ENTREGA PROGRAMADA ── */}
          <div>
            <button
              type="button"
              onClick={() => { setEsProgramado((v) => !v); if (esProgramado) setFechaProgramada('') }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition',
                esProgramado
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600'
              )}
            >
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">
                {esProgramado ? 'Entrega programada activada' : 'Programar para fecha futura'}
              </span>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-normal',
                esProgramado ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'
              )}>
                {esProgramado ? 'activo' : 'opcional'}
              </span>
            </button>

            {esProgramado && (
              <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <label className="block text-xs text-indigo-600 font-medium mb-1.5">
                  Fecha y hora de entrega (hora Lima)
                </label>
                <input
                  type="datetime-local"
                  value={fechaProgramada}
                  min={minFechaProgramada}
                  onChange={(e) => setFechaProgramada(e.target.value)}
                  className="w-full px-3 py-2.5 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-gray-800"
                />
                <p className="text-xs text-indigo-400 mt-1.5">
                  El pedido se activará automáticamente esa mañana y se notificará al cliente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          {items.length > 0 && (
            <span className="text-sm text-gray-500 mr-auto">
              {items.length} {items.length === 1 ? 'producto' : 'productos'} ·{' '}
              <span className="font-semibold text-gray-800">S/{total.toFixed(2)}</span>
            </span>
          )}
          {!items.length && <span className="mr-auto" />}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition"
          >
            {guardando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Check className="w-4 h-4" />
            }
            {guardando ? 'Guardando…' : 'Crear pedido'}
          </button>
        </div>

        {error && (
          <div className="px-6 pb-4">
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          </div>
        )}
      </div>

      {showScanner && (
        <ScannerModal
          onClose={() => setShowScanner(false)}
          onScan={(codigo) => {
            handleScanCode(codigo)
            setShowScanner(false)
          }}
        />
      )}
    </div>
  )
}
