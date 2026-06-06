import { setup, assign } from 'xstate'

export interface OrderContext {
  ferreteriaId: string
  pedidoId: string
  modalidad: 'delivery' | 'recojo'
  estadoPago: string
  metodoPago: string
}

export type OrderEvents =
  | { type: 'PROGRAMAR' }
  | { type: 'CONFIRMAR' }
  | { type: 'PREPARAR' }
  | { type: 'LISTO_RECOJO' }
  | { type: 'ENVIAR' }
  | { type: 'ENTREGAR' }
  | { type: 'CANCELAR'; motivo: string }
  | { type: 'DEVOLVER' }
  | { type: 'VENTA_DIRECTA' } // POS Fast-Track

export const orderMachine = setup({
  types: {
    context: {} as OrderContext,
    events: {} as OrderEvents,
  },
  actions: {
    actualizarBD: ({ context, event }, params: { nuevoEstado: string }) => {
      // Esta acción se interceptará en el servicio para guardar en Supabase
    },
    notificarCliente: ({ context, event }, params: { mensajeKey: string }) => {
      // Hook para disparar WhatsApp
    },
    notificarRepartidores: ({ context }) => {
      // Hook para asignar a repartidores en modo libre
    },
    descontarStock: ({ context }) => {
      // Hook explícito para quitar stock
    },
    revertirStock: ({ context }) => {
      // Hook explícito para devolver stock
    },
    emitirComprobante: ({ context }) => {
      // Hook para llamar a la API de facturación SUNAT
    },
    registrarAuditoria: ({ context, event }, params: { accion: string }) => {
      // Hook para loguear en tabla auditoria
    }
  },
  guards: {
    esDelivery: ({ context }) => context.modalidad === 'delivery',
    esRecojo: ({ context }) => context.modalidad === 'recojo',
    pagoConfirmado: ({ context }) => {
      // MYPE flexibility: El efectivo contra-entrega no bloquea, pero la tarjeta sí.
      if (context.metodoPago === 'tarjeta' && context.estadoPago !== 'pagado') return false;
      return true;
    }
  }
}).createMachine({
  id: 'order',
  initial: 'creado',
  context: {
    ferreteriaId: '',
    pedidoId: '',
    modalidad: 'delivery',
    estadoPago: 'pendiente',
    metodoPago: 'efectivo'
  },
  states: {
    creado: {
      on: {
        PROGRAMAR: { target: 'programado' },
        CONFIRMAR: { target: 'confirmado' },
        VENTA_DIRECTA: { target: 'entregado' }
      }
    },
    programado: {
      on: {
        CONFIRMAR: { target: 'confirmado' },
        CANCELAR: { target: 'cancelado' }
      }
    },
    pendiente: {
      on: {
        CONFIRMAR: { target: 'confirmado' },
        CANCELAR: { target: 'cancelado' }
      }
    },
    confirmado: {
      entry: [
        { type: 'actualizarBD', params: { nuevoEstado: 'confirmado' } },
        'descontarStock',
        { type: 'notificarCliente', params: { mensajeKey: 'confirmado' } },
        'emitirComprobante',
        { type: 'registrarAuditoria', params: { accion: 'cambiar_estado_pedido' } }
      ],
      on: {
        PREPARAR: {
          target: 'en_preparacion',
          guard: 'pagoConfirmado'
        },
        CANCELAR: { target: 'cancelado' }
      }
    },
    en_preparacion: {
      entry: [
        { type: 'actualizarBD', params: { nuevoEstado: 'en_preparacion' } },
        { type: 'notificarCliente', params: { mensajeKey: 'en_preparacion' } },
        { type: 'registrarAuditoria', params: { accion: 'cambiar_estado_pedido' } }
      ],
      on: {
        LISTO_RECOJO: {
          target: 'listo_para_recojo',
          guard: 'esRecojo'
        },
        ENVIAR: {
          target: 'enviado',
          guard: 'esDelivery'
        },
        CANCELAR: { target: 'cancelado' }
      }
    },
    listo_para_recojo: {
      entry: [
        { type: 'actualizarBD', params: { nuevoEstado: 'listo_para_recojo' } },
        { type: 'notificarCliente', params: { mensajeKey: 'listo_para_recojo' } },
        { type: 'registrarAuditoria', params: { accion: 'cambiar_estado_pedido' } }
      ],
      on: {
        ENTREGAR: { target: 'entregado' },
        CANCELAR: { target: 'cancelado' }
      }
    },
    enviado: {
      entry: [
        { type: 'actualizarBD', params: { nuevoEstado: 'enviado' } },
        { type: 'notificarCliente', params: { mensajeKey: 'enviado' } },
        'notificarRepartidores',
        { type: 'registrarAuditoria', params: { accion: 'cambiar_estado_pedido' } }
      ],
      on: {
        ENTREGAR: { target: 'entregado' },
        CANCELAR: { target: 'cancelado' }
      }
    },
    entregado: {
      entry: [
        { type: 'actualizarBD', params: { nuevoEstado: 'entregado' } },
        { type: 'notificarCliente', params: { mensajeKey: 'entregado' } },
        { type: 'registrarAuditoria', params: { accion: 'cambiar_estado_pedido' } }
      ],
      on: {
        DEVOLVER: { target: 'devuelto' }
      }
    },
    cancelado: {
      entry: [
        { type: 'actualizarBD', params: { nuevoEstado: 'cancelado' } },
        'revertirStock',
        { type: 'notificarCliente', params: { mensajeKey: 'cancelado' } },
        { type: 'registrarAuditoria', params: { accion: 'cancelar_pedido' } }
      ],
      type: 'final'
    },
    devuelto: {
      entry: [
        { type: 'actualizarBD', params: { nuevoEstado: 'devuelto' } },
        'revertirStock',
        { type: 'notificarCliente', params: { mensajeKey: 'devuelto' } },
        { type: 'registrarAuditoria', params: { accion: 'cancelar_pedido' } }
      ],
      type: 'final'
    }
  }
})
