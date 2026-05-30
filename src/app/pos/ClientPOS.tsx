'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { matchesFuzzy, formatPEN } from '@/lib/utils'
import { ArrowLeft, ScanLine, Search, Package, Trash2, Banknote, CreditCard, Smartphone, Loader2 } from 'lucide-react'
import ScannerModal from '@/components/ui/ScannerModal'
import { toast } from 'sonner'
import Link from 'next/link'

interface Producto {
  id: string
  nombre: string
  unidad: string
  precio_base: number
  precio_compra: number
  stock: number
  codigo_barras?: string | null
}

interface ItemCarrito {
  producto_id: string
  nombre_producto: string
  unidad: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
}

interface ClientPOSProps {
  productos: Producto[]
  nombreFerreteria: string
}

export default function ClientPOS({ productos, nombreFerreteria }: ClientPOSProps) {
  const router = useRouter()
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [cobrando, setCobrando] = useState(false)

  const busquedaRef = useRef<HTMLInputElement>(null)
  const scanBuffer = useRef('')
  const lastKeyTime = useRef(0)

  const total = items.reduce((acc, i) => acc + (i.cantidad * i.precio_unitario), 0)

  // ── ESCÁNER LÁSER & ATAJOS ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Atajos de pago rápido (si hay items y no estamos cobrando)
      if (items.length > 0 && !cobrando) {
        if (e.key === 'F1') { e.preventDefault(); procesarVenta('efectivo') }
        if (e.key === 'F2') { e.preventDefault(); procesarVenta('yape') }
        if (e.key === 'F3') { e.preventDefault(); procesarVenta('tarjeta') }
      }

      // Lógica de Escáner
      const now = Date.now()
      if (now - lastKeyTime.current > 50) {
        scanBuffer.current = ''
      }
      lastKeyTime.current = now

      if (e.key === 'Enter' && scanBuffer.current.length >= 3) {
        handleScanCode(scanBuffer.current)
        scanBuffer.current = ''
        e.preventDefault()
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [productos, items, cobrando])

  function handleScanCode(codigo: string) {
    const p = productos.find(x => x.codigo_barras === codigo)
    if (p) {
      agregarAlCarrito(p)
      reproducirBeep()
    } else {
      toast.error(`Código desconocido: ${codigo}`)
    }
  }

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

  function agregarAlCarrito(p: Producto) {
    setItems((prev) => {
      const existe = prev.findIndex((i) => i.producto_id === p.id)
      if (existe >= 0) {
        const nuevos = [...prev]
        nuevos[existe].cantidad += 1
        return nuevos
      }
      return [...prev, {
        producto_id: p.id,
        nombre_producto: p.nombre,
        unidad: p.unidad,
        cantidad: 1,
        precio_unitario: p.precio_base,
        costo_unitario: p.precio_compra
      }]
    })
    setBusqueda('')
    setMostrarSugerencias(false)
  }

  function actualizarCantidad(idx: number, delta: number) {
    setItems((prev) => {
      const nuevos = [...prev]
      const next = nuevos[idx].cantidad + delta
      if (next <= 0) {
        return nuevos.filter((_, i) => i !== idx)
      }
      nuevos[idx].cantidad = next
      return nuevos
    })
  }

  async function procesarVenta(metodo: 'efectivo' | 'yape' | 'tarjeta') {
    if (items.length === 0) return
    setCobrando(true)
    try {
      // 1. Crear el pedido directo como entregado y pagado
      const payload = {
        nombre_cliente: 'Cliente Mostrador',
        telefono_cliente: '000000000',
        modalidad: 'recojo',
        estado: 'entregado',
        estado_pago: 'pagado',
        metodo_pago: metodo,
        items,
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Error al registrar la venta')
      
      const { id } = await res.json()
      
      toast.success('Venta registrada con éxito')
      setItems([])
      
      // Opcional: Auto-imprimir comprobante
      // window.open(`/api/orders/${id}/comprobante/pdf`, '_blank')

    } catch (error) {
      toast.error('Ocurrió un error al cobrar')
    } finally {
      setCobrando(false)
    }
  }

  const sugerencias = busqueda.trim().length >= 1
    ? productos.filter((p) => matchesFuzzy(p.nombre, busqueda) && p.stock > 0).slice(0, 8)
    : []

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-zinc-50 overflow-hidden font-sans">
      
      {/* ── PANEL IZQUIERDO: TICKET ── */}
      <div className="flex-1 flex flex-col bg-white border-r border-zinc-200">
        {/* Header POS */}
        <div className="h-16 flex items-center px-4 border-b border-zinc-100 shrink-0">
          <Link href="/dashboard" className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition mr-3">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-zinc-800 leading-tight">Terminal POS</h1>
            <p className="text-xs text-zinc-400">{nombreFerreteria}</p>
          </div>
          <button 
            onClick={() => setItems([])}
            disabled={items.length === 0}
            className="text-xs text-red-500 font-medium px-3 py-1.5 hover:bg-red-50 rounded-lg disabled:opacity-30 transition"
          >
            Vaciar
          </button>
        </div>

        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-zinc-50/50">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <ScanLine className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium text-zinc-500">Escanea un producto</p>
              <p className="text-sm mt-1">O búscalo en el panel derecho</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-zinc-800 truncate">{item.nombre_producto}</h3>
                  <p className="text-xs text-zinc-400">{formatPEN(item.precio_unitario)} / {item.unidad}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => actualizarCantidad(idx, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-medium transition">-</button>
                  <span className="w-8 text-center font-bold text-zinc-800 tabular-nums">{item.cantidad}</span>
                  <button onClick={() => actualizarCantidad(idx, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-medium transition">+</button>
                </div>
                <div className="w-20 text-right font-bold text-zinc-900 tabular-nums">
                  {formatPEN(item.cantidad * item.precio_unitario)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total y Cobro Footer */}
        <div className="shrink-0 bg-white border-t border-zinc-200 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-10">
          <div className="flex items-end justify-between mb-6">
            <span className="text-zinc-500 font-medium uppercase tracking-wider text-sm">Total a pagar</span>
            <span className="text-5xl font-black text-zinc-900 tracking-tight tabular-nums">{formatPEN(total)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => procesarVenta('efectivo')}
              disabled={items.length === 0 || cobrando}
              className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold transition disabled:opacity-40"
            >
              <Banknote className="w-6 h-6" />
              <span>Efectivo <kbd className="hidden md:inline font-mono text-[10px] bg-emerald-200/50 px-1.5 py-0.5 rounded ml-1">F1</kbd></span>
            </button>
            <button
              onClick={() => procesarVenta('yape')}
              disabled={items.length === 0 || cobrando}
              className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold transition disabled:opacity-40"
            >
              <Smartphone className="w-6 h-6" />
              <span>Yape / Plin <kbd className="hidden md:inline font-mono text-[10px] bg-purple-200/50 px-1.5 py-0.5 rounded ml-1">F2</kbd></span>
            </button>
            <button
              onClick={() => procesarVenta('tarjeta')}
              disabled={items.length === 0 || cobrando}
              className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold transition disabled:opacity-40"
            >
              <CreditCard className="w-6 h-6" />
              <span>Tarjeta <kbd className="hidden md:inline font-mono text-[10px] bg-blue-200/50 px-1.5 py-0.5 rounded ml-1">F3</kbd></span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PANEL DERECHO: BUSCADOR & CÁMARA ── */}
      <div className="w-full md:w-[400px] lg:w-[480px] bg-zinc-50 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                ref={busquedaRef}
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true) }}
                onFocus={() => busqueda && setMostrarSugerencias(true)}
                placeholder="Buscar por nombre o SKU..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition font-medium"
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center justify-center w-12 shrink-0 bg-zinc-900 text-white rounded-xl shadow-sm hover:bg-zinc-800 transition"
              title="Abrir Cámara"
            >
              <ScanLine className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {mostrarSugerencias && busqueda ? (
            <div className="space-y-1">
              {sugerencias.length > 0 ? (
                sugerencias.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarAlCarrito(p)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-white rounded-xl transition group"
                  >
                    <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-zinc-900 group-hover:text-white transition">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-zinc-900 truncate">{p.nombre}</h4>
                      <p className="text-xs text-zinc-500">Stk: {p.stock} · {formatPEN(p.precio_base)}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-zinc-500 py-8">No hay resultados para "{busqueda}"</p>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Buscador Rápido</p>
              <p className="text-xs mt-1">Busca productos si no tienen código o no puedes escanearlos</p>
            </div>
          )}
        </div>
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
      
      {cobrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-2xl shadow-2xl border border-zinc-100">
            <Loader2 className="w-8 h-8 text-zinc-900 animate-spin" />
            <p className="font-bold text-zinc-800">Procesando pago...</p>
          </div>
        </div>
      )}
    </div>
  )
}
