import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { geocodificarDireccion } from '@/lib/delivery/geocoding'
import { calcularETA } from '@/lib/delivery/eta'
import { crearEntrega } from '@/lib/delivery/assignment'
import { normalizarTelefono } from '@/lib/utils'

// Repositories
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { ChatRepository } from '@/lib/db/repositories/chat'
import { DeliveryRepository } from '@/lib/db/repositories/logistica'

export const dynamic = 'force-dynamic'

interface ItemNuevoPedido {
  producto_id: string | null
  nombre_producto: string
  unidad: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
}

// POST /api/orders — crear pedido manual desde el panel
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)
  const chatRepo = new ChatRepository(supabase)
  const deliveryRepo = new DeliveryRepository(supabase)

  const body = await request.json()
  const {
    nombre_cliente,
    telefono_cliente,
    modalidad,
    direccion_entrega,
    zona_delivery_id,
    notas,
    items,
    fecha_entrega_programada,
  }: {
    nombre_cliente: string
    telefono_cliente: string
    modalidad: 'delivery' | 'recojo'
    direccion_entrega?: string
    zona_delivery_id?: string
    notas?: string
    items: ItemNuevoPedido[]
    /** Fase V: ISO UTC de entrega programada (ya convertido por el cliente) */
    fecha_entrega_programada?: string
  } = body

  if (!nombre_cliente?.trim()) return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 })
  if (!telefono_cliente?.trim()) return NextResponse.json({ error: 'Teléfono del cliente requerido' }, { status: 400 })
  if (!modalidad) return NextResponse.json({ error: 'Modalidad requerida' }, { status: 400 })
  if (!items?.length) return NextResponse.json({ error: 'Debe incluir al menos un item' }, { status: 400 })
  if (modalidad === 'delivery' && !direccion_entrega?.trim())
    return NextResponse.json({ error: 'Dirección requerida para delivery' }, { status: 400 })

  const total = items.reduce((s: number, i: ItemNuevoPedido) => s + i.cantidad * i.precio_unitario, 0)
  const costo_total = items.reduce((s: number, i: ItemNuevoPedido) => s + i.cantidad * i.costo_unitario, 0)

  // Generar número de pedido
  let numeroPedido
  try {
    numeroPedido = await ventasRepo.generarNumeroPedido(session.ferreteriaId)
  } catch (error: any) {
    return NextResponse.json({ error: `Error generando número: ${error.message}` }, { status: 500 })
  }

  // ── Buscar o crear cliente ───────────────────────────────────────────
  let clienteId: string | null = null
  const telefonoNormalizado = normalizarTelefono(telefono_cliente)

  const clienteExistente = await chatRepo.obtenerClientePorTelefono(session.ferreteriaId, telefonoNormalizado)

  if (clienteExistente) {
    clienteId = clienteExistente.id
    if (nombre_cliente) {
      await supabase
        .from('clientes')
        .update({ nombre: nombre_cliente.trim() })
        .eq('id', clienteId)
    }
  } else {
    try {
      const nuevoCliente = await chatRepo.crearCliente(session.ferreteriaId, telefonoNormalizado, nombre_cliente.trim())
      clienteId = nuevoCliente.id
    } catch (errCliente: any) {
      return NextResponse.json({ error: 'Error al registrar cliente: ' + errCliente?.message }, { status: 500 })
    }
  }

  // Si hay fecha programada, el pedido nace en 'programado' y no en 'pendiente'
  const estadoInicial = fecha_entrega_programada ? 'programado' : 'pendiente'

  let pedido
  try {
    pedido = await ventasRepo.crearPedido(
      session.ferreteriaId,
      {
        clienteId,
        numeroPedido,
        nombreCliente:           nombre_cliente.trim(),
        telefonoCliente:         telefonoNormalizado,
        modalidad,
        direccionEntrega:        direccion_entrega?.trim() ?? null,
        zonaDeliveryId:         zona_delivery_id ?? null,
        estado:                  estadoInicial,
        total,
        costoTotal:              costo_total,
        fechaEntregaProgramada: fecha_entrega_programada ?? null,
      },
      items.map(i => ({
        productoId: i.producto_id,
        nombreProducto: i.nombre_producto,
        unidad: i.unidad,
        cantidad: i.cantidad,
        precioOriginal: i.precio_unitario,
        precioUnitario: i.precio_unitario,
        subtotal: i.cantidad * i.precio_unitario,
        costoUnitario: i.costo_unitario
      }))
    )
  } catch (errPedido: any) {
    return NextResponse.json({ error: errPedido.message ?? 'Error creando pedido' }, { status: 500 })
  }

  // ── Entrega + ETA (fire-and-forget, solo pedidos inmediatos) ─────────────────
  // Los pedidos programados no crean entrega aún — el cron los activa el día indicado.
  if (modalidad === 'delivery' && !fecha_entrega_programada) {
    const pedidoIdEta    = pedido.id
    const ferreteriaIdEta = session.ferreteriaId
    const dirEta = (direccion_entrega ?? '').trim()
    ;(async () => {
      let etaMinutos: number | null = null

      // ── Calcular ETA si hay dirección ────────────────────────────────────────
      if (dirEta) {
        try {
          const { data: ferreteria } = await supabase
            .from('ferreterias')
            .select('lat, lng, nombre')
            .eq('id', ferreteriaIdEta)
            .single()

          if (ferreteria?.lat && ferreteria?.lng) {
            const coords = await geocodificarDireccion(dirEta, ferreteria.nombre ?? 'Perú')

            if (coords) {
              const vehiculos = await deliveryRepo.listarVehiculosActivos(ferreteriaIdEta)
              const velocidadKmh = vehiculos?.[0]?.velocidad_promedio_kmh ?? 30

              const cola = await deliveryRepo.contarEntregasEnCola(ferreteriaIdEta, pedidoIdEta)

              const eta = await calcularETA({
                ferreteriaLat: ferreteria.lat,
                ferreteriaLng: ferreteria.lng,
                clienteLat:    coords.lat,
                clienteLng:    coords.lng,
                velocidadKmh,
                pedidosEnCola: cola ?? 0,
              })

              etaMinutos = eta.tiempoTotalMin

              await supabase
                .from('pedidos')
                .update({ eta_minutos: etaMinutos, cliente_lat: coords.lat, cliente_lng: coords.lng })
                .eq('id', pedidoIdEta)
                .eq('ferreteria_id', ferreteriaIdEta)
            }
          }
        } catch {
          // ETA es best-effort — no falla el pedido
        }
      }

      // ── Crear registro de entrega (con o sin ETA) ────────────────────────────
      await crearEntrega({
        ferreteriaId: ferreteriaIdEta,
        pedidoId:     pedidoIdEta,
        repartidorId: null,   // sin repartidor asignado aún (asignación manual desde dashboard)
        etaMinutos,
        supabase,
      })
    })()
  }

  return NextResponse.json({ id: pedido.id, numero_pedido: pedido.numero_pedido }, { status: 201 })
}

// GET /api/orders
export async function GET(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const ventasRepo = new VentasRepository(supabase)

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')

  try {
    const data = await ventasRepo.obtenerPedidosPorFerreteria(session.ferreteriaId, estado)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
