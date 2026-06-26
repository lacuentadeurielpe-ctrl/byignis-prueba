import { createActor } from 'xstate'
import { orderMachine, OrderContext } from '../machines/order.machine'
import { VentasRepository } from '../db/repositories/ventas'
import { DeliveryRepository } from '../db/repositories/logistica'
import { FacturacionRepository } from '../db/repositories/facturacion'
import { generarYEnviarComprobante } from '../pdf/generar-comprobante'
import { resolverSender } from '../whatsapp/provider'
import { logAccion, AccionAuditada } from '../audit'
import { SupabaseClient } from '@supabase/supabase-js'

export class OrderStateService {
  private ventasRepo: VentasRepository
  private deliveryRepo: DeliveryRepository
  private facturacionRepo: FacturacionRepository

  constructor(
    private supabase: SupabaseClient,
    private ferreteriaId: string,
    private usuarioId: string
  ) {
    this.ventasRepo = new VentasRepository(supabase)
    this.deliveryRepo = new DeliveryRepository(supabase)
    this.facturacionRepo = new FacturacionRepository(supabase)
  }

  // Diccionario de mensajes para WhatsApp
  private getMensaje(estado: string, numeroPedido: string, nombreFerreteria: string): string | null {
    switch (estado) {
      case 'confirmado':
        return `✅ *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* ha sido *confirmado*. Estamos preparando su pedido. ¡Gracias por su preferencia! 🙏`
      case 'en_preparacion':
        return `📦 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* está siendo preparado. Le avisaremos cuando esté listo.`
      case 'listo_para_recojo':
        return `🛍️ *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* está *listo para recojo*. ¡Lo esperamos en tienda!`
      case 'enviado':
        return `🚚 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* está *en camino*. Pronto llegará a su dirección.`
      case 'entregado':
        return `🎉 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* ha sido *entregado*. Esperamos que todo sea de su agrado. ¡Hasta la próxima!`
      case 'cancelado':
        return `❌ *${nombreFerreteria}*\n\nLamentamos informarle que su pedido *${numeroPedido}* ha sido *cancelado*. Para más información contáctenos por este mismo chat.`
      case 'devuelto':
        return `🔄 *${nombreFerreteria}*\n\nSu pedido *${numeroPedido}* ha sido marcado como *devuelto*.`
      default:
        return null
    }
  }

  /**
   * Ejecuta una transición de estado en el pedido, disparando todos los efectos secundarios necesarios de forma segura.
   */
  async transicionarPedido(pedidoId: string, evento: any, notas?: string, motivo_cancelacion?: string) {
    // 1. Cargar el estado actual desde la base de datos
    const pedidoActual = await this.ventasRepo.obtenerPedidoPorId(this.ferreteriaId, pedidoId)
    if (!pedidoActual) throw new Error('Pedido no encontrado')

    const ferreteria = await this.facturacionRepo.obtenerFerreteriaInfo(this.ferreteriaId)
    if (!ferreteria) throw new Error('Ferretería no encontrada')

    const currentState = pedidoActual.estado

    // 2. Preparar el contexto de la máquina
    const context: OrderContext = {
      ferreteriaId: this.ferreteriaId,
      pedidoId,
      modalidad: pedidoActual.modalidad,
      estadoPago: pedidoActual.estado_pago,
      metodoPago: pedidoActual.metodo_pago
    }

    let errorInActions: Error | null = null;
    let finalStateValue = currentState;

    // 3. Crear el Actor de XState inyectando las dependencias (Actions Reales)
    const actor = createActor(orderMachine.provide({
      actions: {
        actualizarBD: async (_, params) => {
          try {
            await this.ventasRepo.actualizarEstadoPedido(this.ferreteriaId, pedidoId, {
              estado: params.nuevoEstado,
              notas: notas ?? pedidoActual.notas,
              ...(params.nuevoEstado === 'cancelado' && motivo_cancelacion
                ? { motivo_cancelacion }
                : {})
            })
            finalStateValue = params.nuevoEstado;

            // ── Sync entrega cuando staff cambia estado de un pedido delivery ──
            // Esto evita la desincronización BUG-008/BUG-009: pedido.estado
            // cambia pero entregas.estado se queda desactualizado.
            if (pedidoActual.modalidad === 'delivery') {
              const entregaEstadoMap: Record<string, string> = {
                enviado:    'en_ruta',
                entregado:  'entregado',
                cancelado:  'fallida',
                devuelto:   'fallida',
              }
              const nuevoEstadoEntrega = entregaEstadoMap[params.nuevoEstado]
              if (nuevoEstadoEntrega) {
                const patchEntrega: Record<string, unknown> = { estado: nuevoEstadoEntrega }
                if (params.nuevoEstado === 'enviado')   patchEntrega.salio_at   = new Date().toISOString()
                if (params.nuevoEstado === 'entregado') patchEntrega.llego_at   = new Date().toISOString()

                await this.supabase
                  .from('entregas')
                  .update(patchEntrega)
                  .eq('pedido_id', pedidoId)
                  .eq('ferreteria_id', this.ferreteriaId)
                  .not('estado', 'in', '("entregado","fallida")')  // no sobrescribir estados finales
              }
            }
          } catch (e: any) { errorInActions = e }
        },
        registrarAuditoria: async (_, params) => {
          try {
            await logAccion({
              ferreteriaId: this.ferreteriaId,
              usuarioId: this.usuarioId,
              accion: params.accion as AccionAuditada,
              entidad: 'pedido',
              entidadId: pedidoId,
              detalle: {
                estado_anterior: currentState,
                estado_nuevo: finalStateValue,
                numero_pedido: pedidoActual.numero_pedido,
                ...(motivo_cancelacion ? { motivo: motivo_cancelacion } : {})
              }
            })
          } catch (e: any) { console.error('Error en auditoría', e) }
        },
        notificarCliente: async (_, params) => {
          try {
            const telefono = (pedidoActual.clientes as any)?.telefono ?? pedidoActual.telefono_cliente
            const msg = this.getMensaje(params.mensajeKey, pedidoActual.numero_pedido, ferreteria.nombre)
            
            if (msg && telefono) {
              const telefWA = ferreteria.telefono_whatsapp.replace(/^\+/, '')
              const sender = await resolverSender(this.supabase, this.ferreteriaId, telefWA)
              await sender?.enviarMensaje({ to: telefono, texto: msg })
            }
          } catch (e) { console.error('Error notificando cliente', e) }
        },
        notificarRepartidores: async () => {
          try {
            if (pedidoActual.modalidad === 'delivery' && (ferreteria as any).modo_asignacion_delivery === 'libre') {
              const repartidores = await this.deliveryRepo.listarRepartidoresActivosConToken(this.ferreteriaId)
              if (repartidores?.length) {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
                const zona = (pedidoActual as any).zonas_delivery?.nombre ?? null
                const nombre = (pedidoActual.clientes as any)?.nombre ?? pedidoActual.nombre_cliente ?? 'Cliente'
                const telefWA2 = ferreteria.telefono_whatsapp.replace(/^\+/, '')
                const senderRep = await resolverSender(this.supabase, this.ferreteriaId, telefWA2)
                if (!senderRep) return

                for (const rep of repartidores) {
                  const msg = `🚚 *Nuevo pedido disponible — ${ferreteria.nombre}*\n\nPedido: *${pedidoActual.numero_pedido}*\nCliente: ${nombre}${zona ? `\nZona: ${zona}` : ''}\nTotal: S/ ${pedidoActual.total.toFixed(2)}\n\n👉 Entra a tu app para aceptarlo:\n${baseUrl}/delivery/${rep.token}`
                  senderRep.enviarMensaje({ to: rep.telefono!, texto: msg }).catch(() => {})
                }
              }
            }
          } catch (e) { console.error('Error notificando repartidores', e) }
        },
        emitirComprobante: async () => {
          try {
            const telefWA3 = ferreteria.telefono_whatsapp.replace(/^\+/, '')
            const senderComp = await resolverSender(this.supabase, this.ferreteriaId, telefWA3)
            await generarYEnviarComprobante({
              pedidoId,
              ferreteriaId: this.ferreteriaId,
              sender: senderComp ?? undefined,
            })
          } catch (e) { console.error('Error emitiendo comprobante', e) }
        },
        descontarStock: async () => {
          // El stock se descuenta en la capa de creación (OrdersService) para reservarlo.
          // Si requerimos descontar en algún cambio de estado futuro, lo pondremos aquí.
        },
        revertirStock: async () => {
          // El trigger 'trigger_pedidos_stock' en Supabase se encarga de revertir el stock 
          // automáticamente cuando el estado cambia a 'cancelado' o 'devuelto'.
          // No necesitamos duplicar la lógica aquí.
        }
      }
    }), {
      state: orderMachine.resolveState({
        value: currentState,
        context
      })
    })

    actor.start()

    // 4. Enviar el evento
    actor.send(evento)

    // 5. Verificar si hubo un cambio de estado válido
    const newState = actor.getSnapshot()
    
    if (newState.value === currentState && evento.type !== 'ACTUALIZAR_NOTAS') {
      throw new Error(`Transición inválida. No se puede pasar al estado deseado desde '${currentState}'`)
    }

    if (errorInActions) {
      throw new Error(`Error durante la transición: ${(errorInActions as any).message}`)
    }

    // Retornar el pedido actualizado simulado
    return {
      ...pedidoActual,
      estado: finalStateValue
    }
  }
}
