'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapPin, Phone, Package, ChevronDown, CheckCircle, AlertTriangle,
  Loader2, RotateCcw, Siren, X, Inbox, BarChart2,
  FileText, Truck, CreditCard, BadgeCheck, Clock, Navigation, NavigationOff,
  ExternalLink, Camera, Image as ImageIcon, XCircle, Wrench, WifiOff, Timer,
} from 'lucide-react'
import PinModal from '@/components/ui/PinModal'
import { cn, formatPEN, labelEstadoPago, colorEstadoPago } from '@/lib/utils'

// ── Helpers de offline queue ──────────────────────────────────────────────────

const OFFLINE_QUEUE_KEY = 'delivery_offline_queue'

interface OfflineAction {
  id:        string
  url:       string
  method:    string
  body:      string
  timestamp: number
}

function guardarAccionOffline(url: string, method: string, body: Record<string, unknown>) {
  try {
    const cola: OfflineAction[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? '[]')
    cola.push({
      id:        crypto.randomUUID(),
      url,
      method,
      body:      JSON.stringify(body),
      timestamp: Date.now(),
    })
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(cola))
  } catch { /* no bloquear si localStorage no disponible */ }
}

async function sincronizarAccionesOffline() {
  try {
    const cola: OfflineAction[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? '[]')
    if (!cola.length) return

    const procesadas: string[] = []
    for (const accion of cola) {
      try {
        const res = await fetch(accion.url, {
          method:  accion.method,
          headers: { 'Content-Type': 'application/json' },
          body:    accion.body,
        })
        if (res.ok) procesadas.push(accion.id)
      } catch { /* mantener en cola si falla */ }
    }

    if (procesadas.length) {
      const restantes = cola.filter(a => !procesadas.includes(a.id))
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(restantes))
    }
  } catch { /* ignorar */ }
}

// ── Formato de tiempo transcurrido para el cronómetro ────────────────────────
function formatearTiempoTranscurrido(ms: number): string {
  const totalSeg = Math.floor(ms / 1000)
  const horas    = Math.floor(totalSeg / 3600)
  const minutos  = Math.floor((totalSeg % 3600) / 60)
  const segundos = totalSeg % 60

  if (horas > 0) return `${horas}h ${minutos.toString().padStart(2, '0')}m`
  return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
}

interface ItemPedido {
  id: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
}

interface EntregaInfo {
  id: string
  estado: string
  eta_actual: string | null
  orden_en_ruta: number | null
  salio_at: string | null
  vehiculo_id: string | null
  vehiculos: { nombre: string; tipo: string } | null
}

interface PedidoDelivery {
  id: string
  numero_pedido: string
  nombre_cliente: string
  telefono_cliente: string
  direccion_entrega: string | null
  total: number
  estado: string
  estado_pago: string
  notas: string | null
  cobrado_monto: number | null
  cobrado_metodo: string | null
  incidencia_tipo: string | null
  incidencia_desc: string | null
  created_at: string
  eta_minutos: number | null
  cliente_id: string | null
  /** null = sin límite configurado; number = crédito disponible en S/ */
  credito_disponible: number | null
  clientes: { nombre: string | null; telefono: string; limite_credito_monto?: number | null } | null
  zonas_delivery: { nombre: string } | null
  items_pedido: ItemPedido[]
  entregas: EntregaInfo[] | null
}

interface CobroHoy {
  id: string
  numero_pedido: string
  total: number
  cobrado_monto: number | null
  cobrado_metodo: string | null
  estado_pago: string | null
  clientes: { nombre: string | null } | null
  created_at: string
}

const INCIDENCIAS = [
  { value: 'cliente_ausente',   label: 'Cliente no estaba' },
  { value: 'pedido_incorrecto', label: 'Pedido incorrecto' },
  { value: 'pago_rechazado',    label: 'No pudo pagar' },
  { value: 'otro',              label: 'Otro problema' },
]

const TIPOS_AVERIA = [
  { value: 'pinchadura',     label: '🔧 Llanta/pinchadura' },
  { value: 'bateria',        label: '🔋 No arranca/batería' },
  { value: 'motor',          label: '⚙️ Falla de motor' },
  { value: 'accidente',      label: '🚨 Accidente' },
  { value: 'otro',           label: '❓ Otro' },
]

const ESTADO_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  confirmado:     { label: 'Confirmado',     icon: '✅', color: 'text-blue-600'   },
  en_preparacion: { label: 'En preparación', icon: '📦', color: 'text-amber-600'  },
  enviado:        { label: 'En camino',       icon: '🚚', color: 'text-orange-600' },
  entregado:      { label: 'Entregado',       icon: '✔️', color: 'text-green-600'  },
  cancelado:      { label: 'Cancelado',       icon: '❌', color: 'text-red-600'    },
}

// labelEstadoPago / colorEstadoPago importados desde @/lib/utils (fuente única de verdad)

type Tab = 'mis_pedidos' | 'disponibles' | 'rendicion'

export default function DeliveryView({
  pedidos: inicialAsignados,
  pedidosDisponibles: inicialDisponibles,
  cobrosHoy: inicialCobros,
  token,
  modo,
  puedeRegistrarDeuda,
  tienePin = false,
  nombre = '',
  ferreteriaNombre = '',
  vehiculoId: vehiculoIdProp,
}: {
  pedidos: PedidoDelivery[]
  pedidosDisponibles: PedidoDelivery[]
  cobrosHoy: CobroHoy[]
  token: string
  modo: 'manual' | 'libre'
  puedeRegistrarDeuda: boolean
  tienePin?: boolean
  /** Nombre del repartidor — para el header sticky reactivo */
  nombre?: string
  /** Nombre de la ferretería — para el header sticky reactivo */
  ferreteriaNombre?: string
  /** ID del vehículo asignado al repartidor (para reportar averías) */
  vehiculoId?: string | null
}) {
  const [pedidos,    setPedidos]    = useState(inicialAsignados)
  const [disponibles, setDisponibles] = useState(inicialDisponibles)
  const [cobrosHoy,  setCobrosHoy]  = useState(inicialCobros)

  const [tab,       setTab]       = useState<Tab>('mis_pedidos')
  const [expandido, setExpandido] = useState<string | null>(inicialAsignados[0]?.id ?? null)
  const [cargando,  setCargando]  = useState<string | null>(null) // pedidoId en proceso
  const [aceptando, setAceptando] = useState<string | null>(null)

  // ── Modo offline — sincronizar acciones pendientes al reconectar ─────────
  const [estaOffline, setEstaOffline] = useState(false)
  useEffect(() => {
    const handleOnline  = () => { setEstaOffline(false); sincronizarAccionesOffline() }
    const handleOffline = () => setEstaOffline(true)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    setEstaOffline(!navigator.onLine)
    // Al cargar, intentar sincronizar si hay acciones pendientes
    if (navigator.onLine) sincronizarAccionesOffline()
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── Cronómetro real desde salio_at ────────────────────────────────────────
  // Busca el primer pedido con entrega que tenga salio_at para iniciar el timer
  const salioPorPrimeraAt = inicialAsignados
    .flatMap(p => p.entregas ?? [])
    .map(e => e.salio_at)
    .filter(Boolean)
    .sort()[0] ?? null

  const [tiempoEnRuta, setTiempoEnRuta] = useState<number>(
    salioPorPrimeraAt ? Date.now() - new Date(salioPorPrimeraAt).getTime() : 0
  )
  const [cronometroActivo, setCronometroActivo] = useState(!!salioPorPrimeraAt)
  const [cronometroInicio, setCronometroInicio] = useState<Date | null>(
    salioPorPrimeraAt ? new Date(salioPorPrimeraAt) : null
  )

  useEffect(() => {
    if (!cronometroActivo || !cronometroInicio) return
    const interval = setInterval(() => {
      setTiempoEnRuta(Date.now() - cronometroInicio.getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [cronometroActivo, cronometroInicio])

  // Restaurar cronómetro desde localStorage si la DB no tiene salio_at
  // (ocurre cuando el repartidor inicia ruta y luego recarga la página sin entrega activa guardada)
  useEffect(() => {
    if (cronometroActivo) return  // ya activo desde datos del servidor
    try {
      const stored = localStorage.getItem(`delivery_cron_${token}`)
      if (stored) {
        const inicio = new Date(stored)
        const elapsedMs = Date.now() - inicio.getTime()
        // Solo restaurar si el inicio fue hace menos de 16 horas (evitar estados fantasma)
        if (!isNaN(inicio.getTime()) && elapsedMs < 16 * 60 * 60 * 1000) {
          setCronometroInicio(inicio)
          setCronometroActivo(true)
          setTiempoEnRuta(elapsedMs)
        } else {
          localStorage.removeItem(`delivery_cron_${token}`)
        }
      }
    } catch { /* localStorage no disponible en este entorno */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const iniciarCronometro = useCallback(() => {
    const ahora = new Date()
    // Persistir en localStorage para sobrevivir recargas de página
    try { localStorage.setItem(`delivery_cron_${token}`, ahora.toISOString()) } catch {}
    setCronometroInicio(ahora)
    setCronometroActivo(true)
    setTiempoEnRuta(0)
    // Registrar salio_at en el servidor
    fetch(`/api/delivery/${token}/iniciar-ruta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salio_at: ahora.toISOString() }),
    }).catch(() => {
      // Modo offline: guardar para sincronizar
      guardarAccionOffline(`/api/delivery/${token}/iniciar-ruta`, 'POST', {
        salio_at: ahora.toISOString()
      })
    })
  }, [token])

  // ── ETA por parada desde GPS ──────────────────────────────────────────────
  const [etasDesdeGPS, setEtasDesdeGPS] = useState<Record<string, number>>({}) // pedidoId → min
  const ultimaGPSRef = useRef<{ lat: number; lng: number } | null>(null)

  const calcularEtasDesdeGPS = useCallback(async (lat: number, lng: number) => {
    ultimaGPSRef.current = { lat, lng }
    // Solo calcular para pedidos en ruta con coords
    const pedidosConCoords = pedidos.filter(p => p.entregas?.[0]?.estado === 'en_ruta')
    if (!pedidosConCoords.length) return

    try {
      const res = await fetch(`/api/delivery/${token}/eta-desde-gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      })
      if (res.ok) {
        const data = await res.json() as Record<string, number>
        setEtasDesdeGPS(data)
      }
    } catch { /* ignorar */ }
  }, [pedidos, token])

  // ── Modal de avería del vehículo ──────────────────────────────────────────
  const [modalAveria, setModalAveria] = useState(false)
  const [averiaDesc,  setAveriaDesc]  = useState('')
  const [averiaTipo,  setAveriaTipo]  = useState('')
  const [averiaGrave, setAveriaGrave] = useState(false)
  const [averiaLoading, setAveriaLoading] = useState(false)

  async function reportarAveria() {
    if (!averiaDesc.trim()) return
    setAveriaLoading(true)
    try {
      const body = {
        accion:       'averia_vehiculo',
        descripcion:  `${averiaTipo ? TIPOS_AVERIA.find(t => t.value === averiaTipo)?.label + ': ' : ''}${averiaDesc}`,
        vehiculo_id:  vehiculoIdProp,
        grave:        averiaGrave,
      }
      const res = await fetch(`/api/delivery/${token}/incidencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok && !navigator.onLine) {
        guardarAccionOffline(`/api/delivery/${token}/incidencia`, 'POST', body)
      }
      setModalAveria(false)
      setAveriaDesc('')
      setAveriaTipo('')
      setAveriaGrave(false)
      alert('⚠️ Avería reportada. El encargado recibirá una notificación y reasignará tus pedidos.')
    } catch {
      if (!navigator.onLine) {
        guardarAccionOffline(`/api/delivery/${token}/incidencia`, 'POST', {
          accion:      'averia_vehiculo',
          descripcion: averiaDesc,
          vehiculo_id: vehiculoIdProp,
          grave:       averiaGrave,
        })
        setModalAveria(false)
        alert('Sin conexión. La avería se enviará cuando vuelvas a tener internet.')
      } else {
        alert('Error al reportar. Intenta de nuevo.')
      }
    } finally {
      setAveriaLoading(false)
    }
  }

  // ── GPS Tracking ──────────────────────────────────────────────────────────
  const [trackingActivo,   setTrackingActivo]   = useState(false)
  const [trackingError,    setTrackingError]    = useState<string | null>(null)
  const watchIdRef    = useRef<number | null>(null)
  const lastSentRef   = useRef<number>(0)

  function iniciarTracking() {
    if (!navigator.geolocation) {
      setTrackingError('Tu navegador no soporta geolocalización')
      return
    }
    setTrackingError(null)
    setTrackingActivo(true)

    // Iniciar cronómetro si no está activo
    if (!cronometroActivo) iniciarCronometro()

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentRef.current < 28_000) return   // throttle: máx 1 req/28s
        lastSentRef.current = now

        // Enviar ubicación al servidor
        fetch(`/api/delivery/${token}/ubicacion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {
          if (!navigator.onLine) {
            guardarAccionOffline(`/api/delivery/${token}/ubicacion`, 'POST', {
              lat: pos.coords.latitude, lng: pos.coords.longitude,
            })
          }
        })

        // Calcular ETAs por parada desde GPS (cada 60s)
        const ahora = Date.now()
        if (ahora - lastSentRef.current < 55_000) {
          calcularEtasDesdeGPS(pos.coords.latitude, pos.coords.longitude)
        }
      },
      (err) => {
        setTrackingError(
          err.code === 1 ? 'Permiso de ubicación denegado. Actívalo en tu navegador.' :
          err.code === 2 ? 'No se pudo obtener la ubicación. Verifica el GPS.' :
          'Error de geolocalización. Intenta de nuevo.',
        )
        setTrackingActivo(false)
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    )
  }

  function detenerTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTrackingActivo(false)
  }

  // Limpiar al desmontar
  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [])

  // Estado inline de cobro por pedido (sin modal)
  // Solo inicializar para pedidos pendientes de cobro (no pagados aún)
  const [cobros, setCobros] = useState<Record<string, { monto: string; metodo: string }>>(() => {
    const initial: Record<string, { monto: string; metodo: string }> = {}
    inicialAsignados.forEach(p => {
      if (p.estado_pago !== 'pagado') {
        initial[p.id] = { monto: p.total != null ? Number(p.total).toFixed(2) : '0.00', metodo: '' }
      }
    })
    return initial
  })

  // Estado de fotos por pedido: { pedidoId → urls[] }
  const [fotosMap, setFotosMap] = useState<Record<string, string[]>>({})
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null) // pedidoId subiendo

  async function subirFoto(pedidoId: string, file: File) {
    setSubiendoFoto(pedidoId)
    try {
      const formData = new FormData()
      formData.append('foto', file)
      const res = await fetch(`/api/delivery/pedido/${pedidoId}/foto?token=${token}`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Error al subir la foto')
        return
      }
      const data = await res.json()
      setFotosMap((prev) => ({
        ...prev,
        [pedidoId]: [...(prev[pedidoId] ?? []), data.fotoUrl],
      }))
    } catch {
      alert('Error de red al subir la foto')
    } finally {
      setSubiendoFoto(null)
    }
  }

  // Modal de incidencia / retorno / emergencia
  const [modal, setModal] = useState<{ pedidoId: string; tipo: 'incidencia' | 'retorno' | 'emergencia' } | null>(null)

  // PIN gate de entrada — si el repartidor tiene PIN, se verifica al abrir el portal
  const [pinEntradaVerificado, setPinEntradaVerificado] = useState(!tienePin)
  const [pinEntradaError, setPinEntradaError]           = useState('')
  const [pinEntradaLoading, setPinEntradaLoading]       = useState(false)
  const [pinEntradaValor, setPinEntradaValor]           = useState('')

  // PIN gate para cobros con deuda
  const [pinPendiente, setPinPendiente] = useState<PedidoDelivery | null>(null)
  const [pinVerificado, setPinVerificado] = useState(false)
  const [incTipo,  setIncTipo]  = useState('')
  const [incDesc,  setIncDesc]  = useState('')
  const [emergMsg, setEmergMsg] = useState('')

  function cobroDeState(pedidoId: string) {
    return cobros[pedidoId] ?? { monto: '', metodo: '' }
  }
  function updateCobro(pedidoId: string, patch: Partial<{ monto: string; metodo: string }>) {
    setCobros(prev => ({ ...prev, [pedidoId]: { ...cobroDeState(pedidoId), ...patch } }))
  }

  // ── Cambiar estado (enviado) ───────────────────────────────────────────────
  async function cambiarEstado(pedidoId: string, nuevoEstado: string) {
    setCargando(pedidoId)
    try {
      const res = await fetch(`/api/delivery/${token}/pedido/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'cambiar_estado', nuevo_estado: nuevoEstado }),
      })
      if (!res.ok) throw new Error('Error')
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
    } catch {
      alert('Error al cambiar estado. Intenta de nuevo.')
    } finally {
      setCargando(null)
    }
  }

  // ── Confirmar entrega ─────────────────────────────────────────────────────
  async function confirmarEntrega(pedido: PedidoDelivery, pinYaVerificado = false) {
    const { monto, metodo } = cobroDeState(pedido.id)
    const montoNum = parseFloat(monto) || 0
    // Para pedidos pre-pagados digitalmente (estado_pago = 'pagado'), no se genera deuda
    // aunque el monto cobrado físicamente sea menor al total
    const esDeuda  = montoNum > 0 && montoNum < pedido.total && pedido.estado_pago !== 'pagado'

    // Validar pago parcial sin permiso
    if (esDeuda && !puedeRegistrarDeuda) {
      alert(`El monto cobrado (${formatPEN(montoNum)}) es menor al total (${formatPEN(pedido.total)}).\n\nNo tienes permiso para registrar deudas. Consulta con el encargado.`)
      return
    }

    // PIN gate: si hay deuda, el repartidor tiene PIN y aún no lo verificó → pedir PIN
    if (esDeuda && tienePin && !pinYaVerificado && !pinVerificado) {
      setPinPendiente(pedido)
      return
    }

    setCargando(pedido.id)
    try {
      const res = await fetch(`/api/delivery/${token}/pedido/${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion:         'entregado',
          cobrado_monto:  montoNum > 0 ? montoNum : null,
          cobrado_metodo: metodo || null,
        }),
      })

      if (res.status === 403) {
        const data = await res.json()
        alert(data.error ?? 'Sin permiso para registrar deuda.')
        return
      }
      if (!res.ok) throw new Error('Error')

      const data = await res.json()
      // Mover a cobros del día
      setCobrosHoy(prev => [{
        id:            pedido.id,
        numero_pedido: pedido.numero_pedido,
        total:         pedido.total,
        cobrado_monto: montoNum > 0 ? montoNum : null,
        cobrado_metodo: metodo || null,
        estado_pago:   data.estado_pago ?? null,
        clientes:      pedido.clientes,
        created_at:    pedido.created_at,
      }, ...prev])
      const nuevaLista = pedidos.filter(p => p.id !== pedido.id)
      setPedidos(nuevaLista)
      // Si se entregaron todos, limpiar cronómetro de localStorage
      if (nuevaLista.length === 0) {
        try { localStorage.removeItem(`delivery_cron_${token}`) } catch {}
      }
    } catch {
      alert('Error al registrar entrega. Intenta de nuevo.')
    } finally {
      setCargando(null)
    }
  }

  // ── Modal incidencia / retorno / emergencia ───────────────────────────────
  function abrirModal(pedidoId: string, tipo: 'incidencia' | 'retorno' | 'emergencia') {
    setIncTipo(''); setIncDesc(''); setEmergMsg('')
    setModal({ pedidoId, tipo })
  }

  async function confirmarModal() {
    if (!modal) return
    setCargando(modal.pedidoId)
    try {
      const body: Record<string, unknown> = { accion: modal.tipo }
      if (modal.tipo === 'incidencia') {
        body.incidencia_tipo = incTipo || 'otro'
        body.incidencia_desc = incDesc || null
      } else if (modal.tipo === 'retorno') {
        body.incidencia_tipo = incTipo || 'otro'
        body.incidencia_desc = incDesc || 'Pedido retornado'
      } else if (modal.tipo === 'emergencia') {
        body.mensaje_emergencia = emergMsg || null
      }

      const res = await fetch(`/api/delivery/${token}/pedido/${modal.pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error')

      if (modal.tipo === 'retorno') {
        setPedidos(prev => prev.filter(p => p.id !== modal.pedidoId))
      } else if (modal.tipo === 'incidencia') {
        setPedidos(prev => prev.map(p =>
          p.id === modal.pedidoId
            ? { ...p, incidencia_tipo: incTipo || 'otro', incidencia_desc: incDesc || null }
            : p
        ))
      }
      setModal(null)
    } catch {
      alert('Error. Intenta de nuevo.')
    } finally {
      setCargando(null)
    }
  }

  // ── Aceptar pedido (modo libre) ───────────────────────────────────────────
  async function aceptarPedido(pedidoId: string) {
    setAceptando(pedidoId)
    try {
      const res = await fetch(`/api/delivery/${token}/aceptar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoId }),
      })
      if (res.status === 409) {
        alert('Este pedido ya fue tomado por otro repartidor.')
        setDisponibles(prev => prev.filter(p => p.id !== pedidoId))
        return
      }
      if (!res.ok) throw new Error('Error')
      const pedidoCompleto = disponibles.find(p => p.id === pedidoId)
      if (pedidoCompleto) {
        setPedidos(prev => [...prev, pedidoCompleto])
        setDisponibles(prev => prev.filter(p => p.id !== pedidoId))
        // Pre-llenar monto cobrado con el total si el pedido no está pagado
        if (pedidoCompleto.estado_pago !== 'pagado') {
          setCobros(prev => ({
            ...prev,
            [pedidoId]: { monto: pedidoCompleto.total != null ? Number(pedidoCompleto.total).toFixed(2) : '0.00', metodo: '' },
          }))
        }
        setTab('mis_pedidos')
        setExpandido(pedidoId)
      }
    } catch {
      alert('Error al aceptar el pedido.')
    } finally {
      setAceptando(null)
    }
  }

  // ── Tarjeta de pedido ─────────────────────────────────────────────────────
  function TarjetaPedido({ pedido, idx, showAcciones, totalPedidos }: {
    pedido: PedidoDelivery
    idx: number
    showAcciones: boolean
    totalPedidos?: number
  }) {
    const isOpen       = expandido === pedido.id
    const nombre       = pedido.clientes?.nombre ?? pedido.nombre_cliente ?? 'Cliente'
    const telefono     = pedido.clientes?.telefono ?? pedido.telefono_cliente ?? null
    const tieneInc     = !!pedido.incidencia_tipo
    // pagado = el dueño confirmó el pago desde el dashboard (Yape/transfer/efectivo previo)
    // Si no está marcado como pagado, el repartidor siempre puede registrar el cobro
    const yaPagado     = pedido.estado_pago === 'pagado'
    const estadoInfo   = ESTADO_LABELS[pedido.estado] ?? { label: pedido.estado, icon: '•', color: 'text-zinc-500' }
    const pagoLabel    = labelEstadoPago(pedido.estado_pago)
    const pagoColor    = colorEstadoPago(pedido.estado_pago)
    const { monto, metodo } = cobroDeState(pedido.id)
    const montoNum     = parseFloat(monto) || 0
    const esParcial    = montoNum > 0 && montoNum < pedido.total
    const enProceso    = cargando === pedido.id
    // Número de parada: priorizar orden_en_ruta de la entrega, si no usar idx+1
    const entrega      = pedido.entregas?.[0]
    const numParada    = entrega?.orden_en_ruta ?? (idx + 1)

    return (
      <div className={cn(
        'bg-white rounded-2xl border shadow-sm overflow-hidden',
        tieneInc ? 'border-amber-300' : 'border-zinc-200'
      )}>
        {/* Cabecera siempre visible */}
        <div className="px-4 py-3.5 cursor-pointer" onClick={() => setExpandido(isOpen ? null : pedido.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                tieneInc ? 'bg-amber-100 text-amber-600' : 'bg-zinc-100 text-zinc-600'
              )}>
                {numParada}
              </div>
              <div>
                <p className="font-semibold text-zinc-900 text-sm">{nombre}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-zinc-400 font-mono">{pedido.numero_pedido}</p>
                  {totalPedidos && totalPedidos > 1 && (
                    <span className="text-[10px] text-zinc-400">
                      · parada {numParada}/{totalPedidos}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <p className="font-bold text-zinc-900 text-sm">{formatPEN(pedido.total)}</p>
              <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
            </div>
          </div>

          {pedido.direccion_entrega && (
            <div className="flex items-center gap-1.5 mt-2">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <p className="text-xs text-zinc-600 truncate">{pedido.direccion_entrega}</p>
            </div>
          )}

          {/* Badges de estado */}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100', estadoInfo.color)}>
              {estadoInfo.icon} {estadoInfo.label}
            </span>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', pagoColor)}>
              {pagoLabel}
            </span>
          </div>

          {/* ETA y vehículo asignado */}
          {(() => {
            const entrega = pedido.entregas?.[0]
            const vehiculo = entrega?.vehiculos
            const etaMin = pedido.eta_minutos
            const etaGPS = etasDesdeGPS[pedido.id]  // ETA real desde GPS
            if (!etaMin && !vehiculo && !etaGPS) return null
            return (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {etaGPS != null ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                    <Navigation className="w-2.5 h-2.5" />
                    {etaGPS < 60 ? `~${etaGPS} min (GPS)` : `~${Math.floor(etaGPS / 60)}h (GPS)`}
                  </span>
                ) : etaMin != null ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">
                    <Clock className="w-2.5 h-2.5" />
                    {etaMin < 60
                      ? `~${etaMin} min`
                      : `~${Math.floor(etaMin / 60)}h${etaMin % 60 > 0 ? ` ${etaMin % 60}min` : ''}`
                    }
                  </span>
                ) : null}
                {vehiculo && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                    <Truck className="w-2.5 h-2.5" />
                    {vehiculo.nombre}
                  </span>
                )}
              </div>
            )
          })()}

          {tieneInc && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Incidencia: {INCIDENCIAS.find(i => i.value === pedido.incidencia_tipo)?.label ?? pedido.incidencia_tipo}</span>
            </div>
          )}

          {/* Banner de cancelado */}
          {pedido.estado === 'cancelado' && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-xs text-red-700 font-medium">Este pedido fue cancelado por la tienda</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPedidos(prev => prev.filter(p => p.id !== pedido.id))
                }}
                className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0 underline"
              >
                Ok
              </button>
            </div>
          )}
        </div>

        {/* Cuerpo expandido */}
        {isOpen && (
          <div className="border-t border-zinc-100 px-4 py-4 bg-zinc-50 space-y-4">
            {/* Teléfono y zona */}
            {telefono && (
              <a href={`tel:${telefono}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <Phone className="w-4 h-4" />
                {telefono}
              </a>
            )}
            {pedido.zonas_delivery && (
              <p className="text-xs text-zinc-500"><span className="font-medium">Zona:</span> {pedido.zonas_delivery.nombre}</p>
            )}
            {pedido.notas && (
              <p className="text-xs text-zinc-500"><span className="font-medium">Notas:</span> {pedido.notas}</p>
            )}

            {/* Productos */}
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Productos</p>
              <div className="space-y-1">
                {pedido.items_pedido.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-700">{item.cantidad}× {item.nombre_producto}</span>
                    <span className="text-zinc-500">{formatPEN(item.precio_unitario * item.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-200 mt-2 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-zinc-700">Total</span>
                <span className="text-zinc-900">{formatPEN(pedido.total)}</span>
              </div>
            </div>

            {showAcciones && (
              <>
                {/* ── Selector de estado ── */}
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Estado del envío</p>
                  <div className="flex gap-2">
                    {(['confirmado', 'en_preparacion'] as const).includes(pedido.estado as any) && (
                      <button
                        onClick={() => cambiarEstado(pedido.id, 'enviado')}
                        disabled={enProceso}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition disabled:opacity-50"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Marcar en camino
                      </button>
                    )}
                    {pedido.estado === 'enviado' && (
                      <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-orange-50 border border-orange-200 text-orange-700">
                        🚚 En camino
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Ver comprobante ── */}
                <button
                  onClick={() => window.open(`/api/orders/${pedido.id}/comprobante/view`, '_blank')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition"
                >
                  <FileText className="w-4 h-4" />
                  Ver comprobante
                </button>

                {/* ── Sección de cobro ── */}
                <div className="bg-white rounded-xl border border-zinc-200 p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-zinc-500" />
                    <p className="text-sm font-semibold text-zinc-800">Cobro</p>
                  </div>

                  {yaPagado ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
                      <BadgeCheck className="w-4 h-4 shrink-0" />
                      <span>Cobro ya registrado — {pedido.cobrado_monto != null ? formatPEN(pedido.cobrado_monto) : ''}</span>
                    </div>
                  ) : (
                    <>
                      {/* Método de pago */}
                      <div className="flex gap-2">
                        {[
                          { value: 'efectivo',      label: '💵',  name: 'Efectivo' },
                          { value: 'yape',          label: '📱',  name: 'Yape' },
                          { value: 'transferencia', label: '🏦',  name: 'Transfer' },
                        ].map(({ value, label, name }) => (
                          <button
                            key={value}
                            onClick={() => updateCobro(pedido.id, { metodo: metodo === value ? '' : value })}
                            className={cn(
                              'flex-1 py-2 rounded-xl text-xs font-medium border transition flex flex-col items-center gap-0.5',
                              metodo === value
                                ? 'bg-zinc-900 border-zinc-900 text-white'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                            )}
                          >
                            <span className="text-base leading-none">{label}</span>
                            <span>{name}</span>
                          </button>
                        ))}
                      </div>

                      {/* Monto */}
                      <div>
                        <label className="text-xs text-zinc-500 font-medium mb-1 block">
                          Monto cobrado al entregar
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-medium">S/</span>
                          <input
                            type="number" step="0.10" min="0"
                            value={monto}
                            onChange={(e) => updateCobro(pedido.id, { monto: e.target.value })}
                            placeholder={pedido.total != null ? Number(pedido.total).toFixed(2) : '0.00'}
                            className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                          />
                        </div>
                        {/* Aviso cuando no hay monto registrado */}
                        {montoNum === 0 && (
                          <p className="mt-1.5 text-[11px] text-amber-600 flex items-center gap-1">
                            ⚠️ Sin monto — el pedido quedará como <strong>pago pendiente</strong>
                          </p>
                        )}
                      </div>

                      {/* Banner crédito disponible del cliente */}
                      {(() => {
                        const disp = pedido.credito_disponible
                        if (disp == null) return null // sin límite configurado (null o undefined)
                        if (disp <= 0) return (
                          <div className="text-xs rounded-xl px-3 py-2 bg-red-50 text-red-700 border border-red-200">
                            🚫 Este cliente <strong>no puede recibir más crédito</strong>. Tiene deudas sin pagar que alcanzaron su límite. Comunícate con el encargado.
                          </div>
                        )
                        return (
                          <div className="text-xs rounded-xl px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200">
                            💳 Crédito disponible del cliente: <strong>S/ {disp.toFixed(2)}</strong>
                          </div>
                        )
                      })()}

                      {/* Aviso de cobro parcial */}
                      {esParcial && (
                        <div className={cn(
                          'text-xs rounded-xl px-3 py-2',
                          !puedeRegistrarDeuda
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : pedido.credito_disponible !== null && pedido.credito_disponible <= 0
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        )}>
                          {!puedeRegistrarDeuda
                            ? `❌ Cobro parcial no permitido. Debes cobrar S/${Number(pedido.total ?? 0).toFixed(2)} completo o consultar con el encargado.`
                            : pedido.credito_disponible !== null && pedido.credito_disponible <= 0
                              ? `❌ Este cliente no puede recibir deuda. Debes cobrar el monto completo.`
                              : `⚠️ Cobro parcial: S/${montoNum.toFixed(2)} de S/${Number(pedido.total ?? 0).toFixed(2)} — se registrará deuda de S/${(Number(pedido.total ?? 0) - montoNum).toFixed(2)}`
                          }
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Cómo llegar + Foto ── */}
                <div className="flex gap-2">
                  {pedido.direccion_entrega && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.direccion_entrega)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Cómo llegar
                    </a>
                  )}
                  <label className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 transition cursor-pointer',
                    subiendoFoto === pedido.id && 'opacity-50 pointer-events-none'
                  )}>
                    {subiendoFoto === pedido.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Camera className="w-3.5 h-3.5" />
                    }
                    {subiendoFoto === pedido.id ? 'Subiendo…' : 'Foto evidencia'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) subirFoto(pedido.id, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>

                {/* Preview de fotos subidas */}
                {(fotosMap[pedido.id]?.length ?? 0) > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {fotosMap[pedido.id].map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-zinc-200 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 right-0 bg-black/40 rounded-tl-lg px-1">
                          <ImageIcon className="w-2.5 h-2.5 text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* ── Botones de acción ── */}
                <div className="space-y-2">
                  <button
                    onClick={() => confirmarEntrega(pedido)}
                    disabled={enProceso || (!yaPagado && esParcial && (!puedeRegistrarDeuda || (pedido.credito_disponible !== null && pedido.credito_disponible <= 0)))}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition"
                  >
                    {enProceso ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirmar entrega
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirModal(pedido.id, 'incidencia')}
                      disabled={enProceso}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-medium py-2.5 rounded-xl text-xs transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Problema
                    </button>
                    <button
                      onClick={() => abrirModal(pedido.id, 'retorno')}
                      disabled={enProceso}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-medium py-2.5 rounded-xl text-xs transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retornar
                    </button>
                    <button
                      onClick={() => abrirModal(pedido.id, 'emergencia')}
                      disabled={enProceso}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium py-2.5 rounded-xl text-xs transition"
                    >
                      <Siren className="w-3.5 h-3.5" />
                      SOS
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'mis_pedidos',  label: 'Mis pedidos',  count: pedidos.length },
    ...(modo === 'libre' ? [{ id: 'disponibles' as Tab, label: 'Disponibles', count: disponibles.length }] : []),
    { id: 'rendicion', label: 'Mi día', count: cobrosHoy.length },
  ]

  const totalCobradoHoy  = cobrosHoy.reduce((s, c) => s + (c.cobrado_monto ?? 0), 0)
  const totalEsperadoHoy = cobrosHoy.reduce((s, c) => s + c.total, 0)
  const entregasHoy      = cobrosHoy.length

  // ── PIN Gate de entrada ────────────────────────────────────────────────────
  async function verificarPinEntrada() {
    if (!pinEntradaValor.trim()) return
    setPinEntradaLoading(true)
    setPinEntradaError('')
    try {
      const res = await fetch(`/api/delivery/${token}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinEntradaValor }),
      })
      if (res.ok) {
        setPinEntradaVerificado(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setPinEntradaError(data.error ?? 'PIN incorrecto')
        setPinEntradaValor('')
      }
    } catch {
      setPinEntradaError('Error de conexión. Intenta de nuevo.')
    } finally {
      setPinEntradaLoading(false)
    }
  }

  if (!pinEntradaVerificado) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-lg p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-7 h-7 text-orange-500" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">{nombre || 'Portal Repartidor'}</h2>
          <p className="text-sm text-zinc-500 mb-6">{ferreteriaNombre}</p>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Ingresa tu PIN</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinEntradaValor}
            onChange={e => setPinEntradaValor(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && verificarPinEntrada()}
            placeholder="••••"
            className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 border-2 border-zinc-200 rounded-xl focus:outline-none focus:border-orange-400 transition mb-3"
            autoFocus
          />
          {pinEntradaError && (
            <p className="text-xs text-red-500 mb-3 flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {pinEntradaError}
            </p>
          )}
          <button
            onClick={verificarPinEntrada}
            disabled={pinEntradaLoading || !pinEntradaValor}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            {pinEntradaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Entrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header sticky reactivo — se actualiza al confirmar entregas */}
      {nombre && (
        <div className="bg-orange-500 text-white px-4 py-4 sticky top-0 z-10 shadow-sm -mx-4 -mt-4 mb-4">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">{nombre}</p>
              <p className="text-xs text-orange-100">{ferreteriaNombre}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold">{pedidos.length}</p>
              <p className="text-xs text-orange-100">pendientes</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-zinc-200 p-1 mb-4 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-2 text-xs font-medium rounded-lg transition',
              tab === t.id ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn(
                'ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold',
                tab === t.id ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Mis pedidos */}
      {tab === 'mis_pedidos' && (
        <div className="space-y-3">
          {pedidos.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">Sin entregas asignadas</p>
              {modo === 'libre' && disponibles.length > 0 && (
                <button
                  onClick={() => setTab('disponibles')}
                  className="mt-3 text-sm text-zinc-600 hover:text-zinc-900 font-medium underline"
                >
                  Ver pedidos disponibles →
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ── Banner de ruta + GPS tracking ── */}
              {(() => {
                const rutaOptimizada = pedidos.some(p => p.entregas?.[0]?.orden_en_ruta != null)
                const etaMax = pedidos.length > 0
                  ? Math.max(...pedidos.map(p => p.eta_minutos ?? 0))
                  : 0
                const multiParada = pedidos.length >= 2
                return (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 space-y-2.5">
                    {/* Fila título */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Truck className="w-4 h-4 text-orange-600 shrink-0" />
                        <p className="text-sm font-semibold text-orange-800">
                          {multiParada ? `Ruta con ${pedidos.length} paradas` : 'Tu entrega de hoy'}
                        </p>
                        {rutaOptimizada && multiParada && (
                          <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium">
                            ✓ Optimizada
                          </span>
                        )}
                      </div>
                      {/* Botón GPS */}
                      {trackingActivo ? (
                        <button
                          onClick={detenerTracking}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-green-100 border border-green-300 text-green-800 rounded-xl hover:bg-green-200 transition shrink-0"
                        >
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          GPS activo
                          <NavigationOff className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={iniciarTracking}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition shrink-0"
                        >
                          <Navigation className="w-3 h-3" />
                          {cronometroActivo ? 'GPS' : 'Iniciar ruta'}
                        </button>
                      )}
                    </div>

                    {/* Cronómetro — tiempo transcurrido desde salio_at */}
                    {cronometroActivo && tiempoEnRuta > 0 && (
                      <div className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-orange-600" />
                          <span className="text-xs font-medium text-orange-800">En ruta hace</span>
                        </div>
                        <span className="text-base font-bold font-mono text-orange-900">
                          {formatearTiempoTranscurrido(tiempoEnRuta)}
                        </span>
                      </div>
                    )}
                    {!cronometroActivo && (
                      <button
                        onClick={iniciarCronometro}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition"
                      >
                        <Timer className="w-3.5 h-3.5" />
                        Marcar salida (iniciar cronómetro)
                      </button>
                    )}

                    {/* Info */}
                    {multiParada && (
                      <p className="text-xs text-orange-700">
                        📦 Carga en orden <strong>inverso</strong>: parada {pedidos.length} abajo, parada 1 arriba.
                      </p>
                    )}
                    {etaMax > 0 && (
                      <p className="text-xs text-orange-600">
                        ⏱ {multiParada ? 'ETA última parada' : 'ETA estimado'}:{' '}
                        <strong>
                          {etaMax < 60 ? `~${etaMax} min` : `~${Math.floor(etaMax / 60)}h${etaMax % 60 > 0 ? ` ${etaMax % 60}min` : ''}`}
                        </strong>
                      </p>
                    )}

                    {/* Botón de avería del vehículo */}
                    <button
                      onClick={() => setModalAveria(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Reportar avería del vehículo
                    </button>

                    {trackingError && (
                      <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">⚠️ {trackingError}</p>
                    )}
                    {trackingActivo && (
                      <p className="text-[11px] text-green-700">
                        📍 Compartiendo tu ubicación en tiempo real con los clientes
                      </p>
                    )}
                    {/* Banner offline */}
                    {estaOffline && (
                      <div className="flex items-center gap-1.5 bg-zinc-800 text-white text-[11px] px-3 py-2 rounded-xl">
                        <WifiOff className="w-3.5 h-3.5 shrink-0" />
                        Sin conexión — tus acciones se guardarán y enviarán al volver
                      </div>
                    )}
                  </div>
                )
              })()}
              {pedidos.map((p, i) => (
                <TarjetaPedido key={p.id} pedido={p} idx={i} showAcciones totalPedidos={pedidos.length} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Tab: Disponibles (modo libre) */}
      {tab === 'disponibles' && (
        <div className="space-y-3">
          {disponibles.length === 0 ? (
            <div className="text-center py-16">
              <Inbox className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">No hay pedidos disponibles</p>
              <p className="text-sm text-zinc-500 mt-1">Regresa en unos momentos</p>
            </div>
          ) : (
            disponibles.map((p, i) => (
              <div key={p.id}>
                <TarjetaPedido pedido={p} idx={i} showAcciones={false} totalPedidos={disponibles.length} />
                <div className="px-4 py-3 bg-white border border-t-0 border-zinc-200 rounded-b-2xl -mt-2">
                  <button
                    onClick={() => aceptarPedido(p.id)}
                    disabled={aceptando === p.id}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition"
                  >
                    {aceptando === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Tomar este pedido
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Mi día (rendición) */}
      {tab === 'rendicion' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-zinc-500" />
              <p className="text-sm font-semibold text-zinc-900">Resumen del día</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                <p className="text-xs text-zinc-400 mb-1">Entregas</p>
                <p className="text-2xl font-bold text-zinc-900">{entregasHoy}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600 mb-1">Cobrado</p>
                <p className="text-lg font-bold text-green-700">{formatPEN(totalCobradoHoy)}</p>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                <p className="text-xs text-zinc-400 mb-1">Total pedidos</p>
                <p className="text-lg font-bold text-zinc-700">{formatPEN(totalEsperadoHoy)}</p>
              </div>
            </div>
            {totalEsperadoHoy > 0 && totalCobradoHoy !== totalEsperadoHoy && (
              <div className={cn(
                'mt-3 text-xs rounded-lg px-3 py-2 text-center font-medium',
                totalCobradoHoy < totalEsperadoHoy ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
              )}>
                Diferencia: {totalCobradoHoy >= totalEsperadoHoy ? '+' : ''}{formatPEN(totalCobradoHoy - totalEsperadoHoy)}
              </div>
            )}
          </div>

          {cobrosHoy.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <p className="text-sm">Aún no hay entregas completadas hoy</p>
            </div>
          ) : (
            cobrosHoy.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-zinc-200 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{c.clientes?.nombre ?? 'Cliente'}</p>
                  <p className="text-xs text-zinc-400 font-mono">{c.numero_pedido}</p>
                  {c.cobrado_metodo && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {{ efectivo: '💵', yape: '📱', transferencia: '🏦' }[c.cobrado_metodo] ?? ''} {c.cobrado_metodo}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-green-700">
                    {c.cobrado_monto != null ? formatPEN(c.cobrado_monto) : '—'}
                  </p>
                  {c.estado_pago && (
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      colorEstadoPago(c.estado_pago)
                    )}>
                      {labelEstadoPago(c.estado_pago)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: incidencia / retorno / emergencia */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl mb-2">
            <div className="flex items-center justify-between mb-4">
              {modal.tipo === 'incidencia'  && <h3 className="font-bold text-zinc-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Reportar problema</h3>}
              {modal.tipo === 'retorno'     && <h3 className="font-bold text-zinc-900 flex items-center gap-2"><RotateCcw className="w-5 h-5 text-zinc-500" /> Retornar pedido</h3>}
              {modal.tipo === 'emergencia'  && <h3 className="font-bold text-zinc-900 flex items-center gap-2"><Siren className="w-5 h-5 text-red-500" /> Emergencia</h3>}
              <button onClick={() => setModal(null)} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
            </div>

            {(modal.tipo === 'incidencia' || modal.tipo === 'retorno') && (
              <>
                {modal.tipo === 'retorno' && (
                  <p className="text-sm text-zinc-600 mb-3">El pedido vuelve a la tienda y se desasignará de tu lista.</p>
                )}
                <p className="text-xs text-zinc-500 mb-2 font-medium">¿Qué pasó?</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {INCIDENCIAS.map(({ value, label }) => (
                    <button key={value} onClick={() => setIncTipo(value)}
                      className={cn('py-2 px-3 rounded-xl text-xs font-medium border transition text-left',
                        incTipo === value ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                      )}>{label}</button>
                  ))}
                </div>
                <textarea value={incDesc} onChange={(e) => setIncDesc(e.target.value)}
                  placeholder="Detalle adicional (opcional)…" rows={2}
                  className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </>
            )}

            {modal.tipo === 'emergencia' && (
              <>
                <p className="text-sm text-zinc-600 mb-3">Se enviará un mensaje de emergencia al encargado por WhatsApp.</p>
                <textarea value={emergMsg} onChange={(e) => setEmergMsg(e.target.value)}
                  placeholder="Describe la emergencia…" rows={3}
                  className="w-full text-sm border border-red-200 rounded-xl px-3 py-2 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 text-sm text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition">
                Cancelar
              </button>
              <button
                onClick={confirmarModal}
                disabled={
                  cargando !== null ||
                  ((modal.tipo === 'incidencia' || modal.tipo === 'retorno') && !incTipo)
                }
                className={cn(
                  'flex-1 py-2.5 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50',
                  modal.tipo === 'emergencia' ? 'bg-red-500 hover:bg-red-600 text-white' :
                  modal.tipo === 'retorno'    ? 'bg-zinc-700 hover:bg-zinc-800 text-white' :
                  'bg-amber-500 hover:bg-amber-600 text-white'
                )}
              >
                {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                {modal.tipo === 'emergencia' ? 'Enviar alerta' : modal.tipo === 'retorno' ? 'Confirmar retorno' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de avería del vehículo ─────────────────────────────────────── */}
      {modalAveria && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl mb-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-red-500" /> Reportar avería del vehículo
              </h3>
              <button onClick={() => setModalAveria(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-zinc-600 mb-3">
              El encargado será notificado y tus pedidos serán reasignados a otro repartidor.
            </p>

            {/* Tipo de avería */}
            <p className="text-xs text-zinc-500 mb-2 font-medium">Tipo de avería</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {TIPOS_AVERIA.map(({ value, label }) => (
                <button key={value} onClick={() => setAveriaTipo(value)}
                  className={cn('py-2 px-3 rounded-xl text-xs font-medium border transition text-left',
                    averiaTipo === value ? 'bg-red-50 border-red-400 text-red-700' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                  )}>
                  {label}
                </button>
              ))}
            </div>

            {/* Descripción libre */}
            <textarea
              value={averiaDesc}
              onChange={(e) => setAveriaDesc(e.target.value)}
              placeholder="Describe qué pasó con el vehículo…"
              rows={3}
              className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2 mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />

            {/* Gravedad */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={averiaGrave}
                onChange={(e) => setAveriaGrave(e.target.checked)}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-xs font-medium text-zinc-700">
                🔴 Avería grave — no puede moverse, necesita grúa/taller
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setModalAveria(false)}
                className="flex-1 py-2.5 text-sm text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={reportarAveria}
                disabled={averiaLoading || !averiaDesc.trim()}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center gap-2"
              >
                {averiaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                Reportar avería
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PIN Modal para cobros con deuda ──────────────────────────────────── */}
      {pinPendiente && (
        <PinModal
          open={!!pinPendiente}
          onClose={() => setPinPendiente(null)}
          miembroId=""
          verificarUrl={`/api/delivery/${token}/pin`}
          accion="Confirmar cobro parcial (deuda)"
          onSuccess={() => {
            setPinVerificado(true)
            const pedido = pinPendiente
            setPinPendiente(null)
            // Pequeño delay para que el modal cierre antes de proceder
            setTimeout(() => confirmarEntrega(pedido, true), 100)
          }}
        />
      )}
    </>
  )
}
