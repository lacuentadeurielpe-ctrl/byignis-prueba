'use client'

import { useRef, useEffect, useMemo, useState } from 'react'
import { matchesFuzzy, formatPEN } from '@/lib/utils'
import {
  ArrowLeft, ScanLine, Search, Package, Trash2,
  Banknote, CreditCard, Smartphone, Loader2,
  User, CalendarClock, CheckCircle2
} from 'lucide-react'
import ScannerModal from '@/components/ui/ScannerModal'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePOSStore, ProductoPOS } from '@/stores/usePOSStore'
import { useRealtimeProductos } from '@/lib/hooks/useRealtimeProductos'

interface ClientPOSProps {
  productos: ProductoPOS[]
  nombreFerreteria: string
  ferreteriaId: string
  /** true si hay proveedor de facturación disponible (Nubefact o SUNAT Directo) */
  facturacionActiva?: boolean
}

export default function ClientPOS({ productos: productosIniciales, nombreFerreteria, ferreteriaId, facturacionActiva = false }: ClientPOSProps) {
  // Catálogo en vivo: el stock se actualiza tras cada venta (propia o de otro
  // cajero/dispositivo) sin recargar la página.
  const productos = useRealtimeProductos(ferreteriaId, productosIniciales)
  const {
    items, agregarItem, actualizarCantidad, eliminarItem, vaciarCarrito, total,
    busqueda, setBusqueda, mostrarSugerencias, setMostrarSugerencias,
    showScanner, setShowScanner, cobrando, setCobrando,
    nombreCliente, setNombreCliente, telefonoCliente, setTelefonoCliente,
    dniRuc, setDniRuc, buscandoRuc, setBuscandoRuc,
    tipoComprobante, setTipoComprobante, esProgramado, setEsProgramado,
    fechaProgramada, setFechaProgramada, resetearDespuesDeVenta
  } = usePOSStore()

  const busquedaRef = useRef<HTMLInputElement>(null)
  const scanBuffer = useRef('')
  const lastKeyTime = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Búsqueda con debounce (150ms) para no correr Levenshtein en cada tecla ──
  // busquedaDelay se actualiza 150ms después de que el usuario deja de escribir.
  const [busquedaDelay, setBusquedaDelay] = useState(busqueda)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setBusquedaDelay(busqueda), 150)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  // Fecha mínima = ahora + 30min redondeado a 15min
  const minFechaProgramada = (() => {
    const d = new Date(Date.now() + 30 * 60_000)
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()

  // ── ESCÁNER LÁSER & ATAJOS ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // Atajos de pago rápido (solo si hay items, no estamos cobrando, y no hay foco en inputs)
      if (items.length > 0 && !cobrando && !esProgramado && !isInput) {
        if (e.key === 'F1') { e.preventDefault(); procesarVenta('efectivo') }
        if (e.key === 'F2') { e.preventDefault(); procesarVenta('yape') }
        if (e.key === 'F3') { e.preventDefault(); procesarVenta('tarjeta') }
      }

      // Lógica de Escáner Láser
      const now = Date.now()
      if (now - lastKeyTime.current > 50) scanBuffer.current = ''
      lastKeyTime.current = now

      if (e.key === 'Enter' && scanBuffer.current.length >= 3) {
        handleScanCode(scanBuffer.current)
        scanBuffer.current = ''
        if (!isInput) e.preventDefault()
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [productos, items, cobrando, esProgramado, tipoComprobante, dniRuc, nombreCliente, telefonoCliente])

  function handleScanCode(codigo: string) {
    const p = productos.find(x => x.codigo_barras === codigo)
    if (p) {
      agregarItem(p)
      reproducirBeep()
    } else {
      toast.error(`Código desconocido: ${codigo}`)
    }
  }

  // Reutilizamos un solo AudioContext para evitar acumulación de contextos no cerrados
  // (cada `new AudioContext()` sin `.close()` consume recursos y puede congelar el tab)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function reproducirBeep() {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx  = audioCtxRef.current
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      osc.start(); osc.stop(ctx.currentTime + 0.1)
    } catch {}
  }

  // ── Consulta SUNAT por RUC / DNI ──
  async function consultarRuc(valor: string) {
    const limpio = valor.replace(/\D/g, '')
    if (limpio.length !== 11 && limpio.length !== 8) return
    setBuscandoRuc(true)
    try {
      const res = await fetch('/api/sunat/ruc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruc: limpio })
      })
      if (res.ok) {
        const data = await res.json()
        const razon = data.razon_social || data.nombre || ''
        if (razon) {
          setNombreCliente(razon)
          toast.success('Nombre obtenido de SUNAT')
        }
      }
    } catch {}
    setBuscandoRuc(false)
  }

  // Enviar un pedido programado (sin cobro inmediato)
  async function guardarProgramado() {
    if (items.length === 0) return
    if (!fechaProgramada) {
      toast.error('Selecciona la fecha y hora de entrega')
      return
    }

    const d = new Date(`${fechaProgramada}:00-05:00`)
    if (isNaN(d.getTime())) {
      toast.error('Fecha inválida')
      return
    }

    const nombreFinal = nombreCliente.trim() || 'Cliente Mostrador'
    const telefonoFinal = telefonoCliente.trim() || '000000000'

    setCobrando(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_cliente: nombreFinal,
          telefono_cliente: telefonoFinal,
          modalidad: 'recojo',
          items,
          fecha_entrega_programada: d.toISOString(),
        })
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al programar pedido')
      }

      toast.success('Pedido programado correctamente')
      resetearDespuesDeVenta()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al programar')
    } finally {
      setCobrando(false)
    }
  }

  async function procesarVenta(metodo: 'efectivo' | 'yape' | 'tarjeta') {
    if (items.length === 0) return

    const nombreFinal = nombreCliente.trim() || 'Cliente Mostrador'
    const telefonoFinal = telefonoCliente.trim() || '000000000'

    // Validar factura → RUC 11 dígitos obligatorio
    if (tipoComprobante === 'factura') {
      const rucLimpio = dniRuc.replace(/\D/g, '')
      if (rucLimpio.length !== 11) {
        toast.error('Factura requiere un RUC de 11 dígitos')
        return
      }
      if (!nombreCliente.trim()) {
        toast.error('Factura requiere la razón social del cliente')
        return
      }
    }

    setCobrando(true)
    // Safety: si algo falla silenciosamente, el overlay se limpia en 30s
    const safetyTimer = setTimeout(() => setCobrando(false), 30_000)
    try {
      // 1. Crear el pedido (nace como 'pendiente')
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_cliente: nombreFinal,
          telefono_cliente: telefonoFinal,
          modalidad: 'recojo',
          items,
          venta_directa: true,
          estado_pago: 'pagado',
          metodo_pago: metodo,
        })
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al registrar la venta')
      }

      const { id: pedidoId } = await res.json()

      // 3. Comprobante
      if (tipoComprobante === 'nota_venta') {
        await fetch(`/api/orders/${pedidoId}/comprobante`, { method: 'POST' })
      } else {
        const rucLimpio = dniRuc.replace(/\D/g, '')
        const emitRes = await fetch('/api/comprobantes/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedido_id: pedidoId,
            tipo: tipoComprobante,
            cliente_nombre: nombreFinal,
            cliente_dni: tipoComprobante === 'boleta' ? rucLimpio : undefined,
            cliente_ruc: tipoComprobante === 'factura' ? rucLimpio : undefined,
          })
        })
        if (emitRes.ok) {
          const body = await emitRes.json()
          if (body.pdfUrl) window.open(body.pdfUrl, '_blank')
          if (body.pdfUrlSecundario) {
             setTimeout(() => window.open(body.pdfUrlSecundario, '_blank'), 100)
          }
        } else {
          toast.error('Venta registrada, pero falló el comprobante electrónico')
        }
      }

      toast.success('¡Venta registrada!')
      resetearDespuesDeVenta()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al cobrar')
    } finally {
      clearTimeout(safetyTimer)
      setCobrando(false)
    }
  }

  // Filtrado memoizado con debounce — evita correr Levenshtein en cada tecla (BUG-007)
  const sugerencias = useMemo(() => {
    const q = busquedaDelay.trim()
    if (q.length < 1) return []
    return productos.filter(p => matchesFuzzy(p.nombre, q) || p.codigo_barras === q).slice(0, 8)
  }, [busquedaDelay, productos])

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-zinc-50 overflow-hidden font-sans">

      {/* ── PANEL IZQUIERDO: TICKET ── */}
      <div className="flex-1 flex flex-col bg-white border-r border-zinc-200 min-w-0">
        {/* Header */}
        <div className="h-14 flex items-center px-4 border-b border-zinc-100 shrink-0 gap-3">
          <Link href="/dashboard" className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-zinc-800 text-sm leading-tight">Terminal POS</h1>
            <p className="text-[11px] text-zinc-400 truncate">{nombreFerreteria}</p>
          </div>
          <button
            onClick={() => vaciarCarrito()}
            disabled={items.length === 0}
            className="text-xs text-red-500 font-medium px-3 py-1.5 hover:bg-red-50 rounded-lg disabled:opacity-30 transition"
          >
            Vaciar
          </button>
        </div>

        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <ScanLine className="w-14 h-14 mb-3 opacity-20" />
              <p className="font-medium text-zinc-500 text-sm">Escanea un producto</p>
              <p className="text-xs mt-1 text-zinc-400">O búscalo en el panel derecho</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-zinc-800 truncate">{item.nombre_producto}</h3>
                  <p className="text-xs text-zinc-400">{formatPEN(item.precio_unitario)} / {item.unidad}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => actualizarCantidad(idx, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold transition text-sm">-</button>
                  <span className="w-7 text-center font-bold text-zinc-800 tabular-nums text-sm">{item.cantidad}</span>
                  <button onClick={() => actualizarCantidad(idx, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold transition text-sm">+</button>
                </div>
                <div className="w-16 text-right font-bold text-zinc-900 tabular-nums text-sm shrink-0">
                  {formatPEN(item.cantidad * item.precio_unitario)}
                </div>
                <button onClick={() => eliminarItem(idx)} className="text-zinc-300 hover:text-red-400 transition shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── FOOTER: CLIENTE + COMPROBANTE + COBRO ── */}
        <div className="shrink-0 bg-white border-t border-zinc-100 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">

          {/* Datos del Cliente */}
          <div className="px-4 pt-4 pb-3 border-b border-zinc-50 space-y-2">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3 h-3" /> Cliente
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Teléfono</label>
                <input
                  value={telefonoCliente}
                  onChange={e => setTelefonoCliente(e.target.value)}
                  placeholder="999 888 777"
                  className="w-full px-2.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Nombre</label>
                <input
                  value={nombreCliente}
                  onChange={e => setNombreCliente(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full px-2.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
                />
              </div>
            </div>
            {/* DNI/RUC opcional con auto-lookup SUNAT */}
            <div className="relative">
              <label className="block text-[10px] text-zinc-400 mb-0.5">DNI / RUC (opcional)</label>
              <div className="flex gap-2">
                <input
                  value={dniRuc}
                  onChange={e => setDniRuc(e.target.value)}
                  onBlur={e => consultarRuc(e.target.value)}
                  placeholder="Para boleta o factura"
                  className="flex-1 px-2.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition font-mono"
                />
                {buscandoRuc && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 self-center shrink-0" />}
              </div>
            </div>
          </div>

          {/* Tipo de Comprobante */}
          <div className="px-4 py-3 border-b border-zinc-50">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Comprobante</p>
            <div className="flex bg-zinc-100 p-0.5 rounded-xl gap-0.5">
              {([
                { key: 'nota_venta', label: 'Nota de Venta' },
                { key: 'boleta', label: 'Boleta' },
                { key: 'factura', label: 'Factura' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setTipoComprobante(key)
                    // Advertir al cajero si selecciona boleta/factura sin proveedor de facturación
                    if (key !== 'nota_venta' && !facturacionActiva) {
                      toast.warning(
                        `Facturación electrónica no configurada (Nubefact o SUNAT Directo). La ${label} se registrará internamente pero NO se enviará a SUNAT.`,
                        { duration: 6000 }
                      )
                    }
                  }}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-semibold rounded-lg transition',
                    tipoComprobante === key
                      ? 'bg-white shadow-sm text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-700'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Aviso persistente si está en modo boleta/factura sin proveedor de facturación */}
            {tipoComprobante !== 'nota_venta' && !facturacionActiva && (
              <p className="mt-1.5 text-[10px] text-amber-600 flex items-center gap-1">
                ⚠️ Facturación electrónica sin configurar — no se emitirá comprobante SUNAT
              </p>
            )}
          </div>

          {/* Toggle Programar */}
          <div className="px-4 py-3 border-b border-zinc-50">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setEsProgramado(!esProgramado)}
                className={cn(
                  'w-9 h-5 rounded-full transition relative shrink-0',
                  esProgramado ? 'bg-zinc-900' : 'bg-zinc-200'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                  esProgramado ? 'left-[18px]' : 'left-0.5'
                )} />
              </div>
              <CalendarClock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-medium text-zinc-600">Programar para después</span>
            </label>
            {esProgramado && (
              <input
                type="datetime-local"
                min={minFechaProgramada}
                value={fechaProgramada}
                onChange={e => setFechaProgramada(e.target.value)}
                className="mt-2 w-full px-2.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
              />
            )}
          </div>

          {/* Total + Botones de Cobro */}
          <div className="px-4 py-4">
            <div className="flex items-end justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total</span>
              <span className="text-4xl font-black text-zinc-900 tabular-nums tracking-tight">{formatPEN(total)}</span>
            </div>

            {esProgramado ? (
              <button
                onClick={() => guardarProgramado()}
                disabled={items.length === 0 || cobrando || !fechaProgramada}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition disabled:opacity-40"
              >
                {cobrando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Guardar Pedido Programado
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => procesarVenta('efectivo')}
                  disabled={items.length === 0 || cobrando}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold transition disabled:opacity-40 text-xs"
                >
                  <Banknote className="w-5 h-5" />
                  <span>Efectivo <kbd className="hidden md:inline font-mono text-[9px] bg-emerald-200/50 px-1 rounded">F1</kbd></span>
                </button>
                <button
                  onClick={() => procesarVenta('yape')}
                  disabled={items.length === 0 || cobrando}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold transition disabled:opacity-40 text-xs"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>Yape/Plin <kbd className="hidden md:inline font-mono text-[9px] bg-purple-200/50 px-1 rounded">F2</kbd></span>
                </button>
                <button
                  onClick={() => procesarVenta('tarjeta')}
                  disabled={items.length === 0 || cobrando}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold transition disabled:opacity-40 text-xs"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Tarjeta <kbd className="hidden md:inline font-mono text-[9px] bg-blue-200/50 px-1 rounded">F3</kbd></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PANEL DERECHO: BUSCADOR ── */}
      <div className="w-full md:w-[360px] lg:w-[420px] bg-zinc-50 flex flex-col shrink-0 border-l border-zinc-100">
        <div className="p-3 border-b border-zinc-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                ref={busquedaRef}
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setMostrarSugerencias(true) }}
                onFocus={() => busqueda && setMostrarSugerencias(true)}
                placeholder="Buscar por nombre o SKU..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition text-sm font-medium"
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center justify-center w-11 shrink-0 bg-zinc-900 text-white rounded-xl shadow-sm hover:bg-zinc-800 transition"
              title="Abrir Cámara"
            >
              <ScanLine className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {mostrarSugerencias && busqueda ? (
            <div className="space-y-1">
              {sugerencias.length > 0 ? sugerencias.map(p => (
                <button
                  key={p.id}
                  onClick={() => agregarItem(p)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 text-left rounded-xl transition group border hover:shadow-sm',
                    p.stock === 0
                      ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50 hover:border-amber-300'
                      : 'border-transparent hover:bg-white hover:border-zinc-200'
                  )}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition',
                    p.stock === 0
                      ? 'bg-amber-100 text-amber-500 group-hover:bg-amber-500 group-hover:text-white'
                      : 'bg-zinc-100 group-hover:bg-zinc-900 group-hover:text-white'
                  )}>
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-zinc-900 truncate">{p.nombre}</h4>
                    <p className="text-xs">
                      <span className={p.stock === 0 ? 'text-amber-600 font-semibold' : 'text-zinc-500'}>
                        Stk: {p.stock}{p.stock === 0 ? ' — sin stock' : ''}
                      </span>
                      <span className="text-zinc-400"> · {formatPEN(p.precio_base)}</span>
                    </p>
                  </div>
                  {p.stock === 0 && (
                    <span className="shrink-0 text-[9px] font-bold bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
                      0
                    </span>
                  )}
                </button>
              )) : (
                <p className="text-center text-sm text-zinc-500 py-8">No hay resultados</p>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
              <Package className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Buscador Rápido</p>
              <p className="text-xs mt-1">Busca si no puedes escanear</p>
            </div>
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <ScannerModal
          onClose={() => setShowScanner(false)}
          onScan={codigo => { handleScanCode(codigo); setShowScanner(false) }}
        />
      )}

      {/* Overlay de procesando */}
      {cobrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-2xl shadow-2xl border border-zinc-100">
            <Loader2 className="w-8 h-8 text-zinc-900 animate-spin" />
            <p className="font-bold text-zinc-800">{esProgramado ? 'Guardando pedido...' : 'Procesando pago...'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
