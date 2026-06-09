/**
 * Queue Item State Machine — Máquina de estados de un ítem en la cola de delivery
 *
 * Ciclo de vida completo de un pedido en la cola:
 *
 *   esperando ──→ asignado ──→ en_ruta ──→ completado
 *       │             │            │
 *       ↓             ↓            ↓
 *   bloqueado      fallido      fallido
 *       │             │
 *       ↓             ↓
 *   reagendado    cancelado
 *       │
 *       ↓
 *   esperando  (re-ingreso con nueva fecha)
 *
 * Estados terminales: completado, cancelado, fallido (agotado)
 *
 * Transiciones:
 *   - ASIGNAR        : esperando | bloqueado → asignado
 *   - INICIAR_RUTA   : asignado → en_ruta
 *   - COMPLETAR      : en_ruta → completado
 *   - INTENTAR_FALLO : en_ruta → fallido (intento fallido, quedan intentos)
 *   - AGOTAR         : fallido → fallido_definitivo (se agotaron los intentos)
 *   - REAGENDAR      : fallido | esperando | bloqueado → reagendado
 *   - REACTIVAR      : reagendado → esperando
 *   - BLOQUEAR       : esperando → bloqueado (cliente ausente / ventana futura)
 *   - DESBLOQUEAR    : bloqueado → esperando
 *   - CANCELAR       : cualquier estado no terminal → cancelado
 */

import { createMachine, assign } from 'xstate'

// ── Context ───────────────────────────────────────────────────────────────────

export interface QueueItemContext {
  itemId:             string
  ferreteriaId:       string
  pedidoId:           string
  entregaId:          string | null
  prioridad:          1 | 2 | 3 | 4 | 5
  score:              number
  intentos:           number
  maxIntentos:        number
  repartidorId:       string | null
  vehiculoId:         string | null
  motivoFallo:        string | null
  motivoBoqueo:       string | null
  bloqueadoHastaAt:   string | null
  reagendadoParaAt:   string | null
  reagendadoMotivo:   string | null
  reagendadoVeces:    number
  asignadoAt:         string | null
  iniciadoAt:         string | null
  completadoAt:       string | null
}

// ── Events ────────────────────────────────────────────────────────────────────

export type QueueItemEvent =
  | { type: 'ASIGNAR'; repartidorId: string; vehiculoId?: string; entregaId?: string }
  | { type: 'INICIAR_RUTA' }
  | { type: 'COMPLETAR' }
  | { type: 'INTENTAR_FALLO'; motivo: string }
  | { type: 'AGOTAR' }
  | { type: 'REAGENDAR'; fechaNuevaAt: string; motivo: string }
  | { type: 'REACTIVAR' }
  | { type: 'BLOQUEAR'; motivo: string; hastaAt: string }
  | { type: 'DESBLOQUEAR' }
  | { type: 'CANCELAR'; motivo?: string }
  | { type: 'ACTUALIZAR_SCORE'; score: number }

// ── Machine ───────────────────────────────────────────────────────────────────

export const queueItemMachine = createMachine({
  id:      'queue-item',
  initial: 'esperando',
  types:   {} as { context: QueueItemContext; events: QueueItemEvent },

  context: ({ input }: {
    input: {
      itemId:       string
      ferreteriaId: string
      pedidoId:     string
      prioridad?:   1 | 2 | 3 | 4 | 5
      score?:       number
      maxIntentos?: number
    }
  }) => ({
    itemId:            input.itemId,
    ferreteriaId:      input.ferreteriaId,
    pedidoId:          input.pedidoId,
    entregaId:         null,
    prioridad:         input.prioridad  ?? 3,
    score:             input.score      ?? 3000,
    intentos:          0,
    maxIntentos:       input.maxIntentos ?? 3,
    repartidorId:      null,
    vehiculoId:        null,
    motivoFallo:       null,
    motivoBoqueo:      null,
    bloqueadoHastaAt:  null,
    reagendadoParaAt:  null,
    reagendadoMotivo:  null,
    reagendadoVeces:   0,
    asignadoAt:        null,
    iniciadoAt:        null,
    completadoAt:      null,
  }),

  states: {
    // ── Esperando asignación ────────────────────────────────────────────────
    esperando: {
      on: {
        ASIGNAR: {
          target: 'asignado',
          actions: assign({
            repartidorId: ({ event }) => event.repartidorId,
            vehiculoId:   ({ event }) => event.vehiculoId ?? null,
            entregaId:    ({ event }) => event.entregaId  ?? null,
            asignadoAt:   () => new Date().toISOString(),
            motivoFallo:  null,
          }),
        },
        BLOQUEAR: {
          target: 'bloqueado',
          actions: assign({
            motivoBoqueo:     ({ event }) => event.motivo,
            bloqueadoHastaAt: ({ event }) => event.hastaAt,
          }),
        },
        REAGENDAR: {
          target: 'reagendado',
          actions: assign({
            reagendadoParaAt: ({ event }) => event.fechaNuevaAt,
            reagendadoMotivo: ({ event }) => event.motivo,
            reagendadoVeces:  ({ context }) => context.reagendadoVeces + 1,
          }),
        },
        CANCELAR: {
          target: 'cancelado',
          actions: assign({
            motivoFallo: ({ event }) => event.motivo ?? 'Cancelado por el sistema',
          }),
        },
        ACTUALIZAR_SCORE: {
          actions: assign({
            score: ({ event }) => event.score,
          }),
        },
      },
    },

    // ── Asignado a repartidor, aún no salió ─────────────────────────────────
    asignado: {
      on: {
        INICIAR_RUTA: {
          target: 'en_ruta',
          actions: assign({
            iniciadoAt: () => new Date().toISOString(),
          }),
        },
        REAGENDAR: {
          // Reasignación antes de salir (ej: repartidor reporta avería)
          target: 'reagendado',
          actions: assign({
            repartidorId:     null,
            vehiculoId:       null,
            asignadoAt:       null,
            reagendadoParaAt: ({ event }) => event.fechaNuevaAt,
            reagendadoMotivo: ({ event }) => event.motivo,
            reagendadoVeces:  ({ context }) => context.reagendadoVeces + 1,
          }),
        },
        CANCELAR: {
          target: 'cancelado',
          actions: assign({
            motivoFallo: ({ event }) => event.motivo ?? 'Cancelado por el sistema',
          }),
        },
      },
    },

    // ── En ruta (repartidor salió con el pedido) ─────────────────────────────
    en_ruta: {
      on: {
        COMPLETAR: {
          target: 'completado',
          actions: assign({
            completadoAt: () => new Date().toISOString(),
            motivoFallo:  null,
          }),
        },
        INTENTAR_FALLO: {
          // Fallo en intento (cliente ausente, dirección incorrecta, etc.)
          target: 'fallido',
          actions: assign({
            intentos:    ({ context }) => context.intentos + 1,
            motivoFallo: ({ event }) => event.motivo,
          }),
        },
        CANCELAR: {
          target: 'cancelado',
          actions: assign({
            motivoFallo: ({ event }) => event.motivo ?? 'Cancelado en ruta',
          }),
        },
      },
    },

    // ── Fallo en intento (puede reagendarse o agotarse) ──────────────────────
    fallido: {
      on: {
        REAGENDAR: {
          target: 'reagendado',
          actions: assign({
            repartidorId:     null,
            vehiculoId:       null,
            asignadoAt:       null,
            iniciadoAt:       null,
            reagendadoParaAt: ({ event }) => event.fechaNuevaAt,
            reagendadoMotivo: ({ event }) => event.motivo,
            reagendadoVeces:  ({ context }) => context.reagendadoVeces + 1,
          }),
        },
        AGOTAR: {
          // Se agotaron todos los intentos → fallo definitivo
          target: 'fallido_definitivo',
        },
        CANCELAR: {
          target: 'cancelado',
          actions: assign({
            motivoFallo: ({ event }) => event.motivo ?? 'Cancelado tras fallo',
          }),
        },
      },
    },

    // ── Bloqueado temporalmente (ventana programada / cliente ausente) ────────
    bloqueado: {
      on: {
        DESBLOQUEAR: {
          target: 'esperando',
          actions: assign({
            motivoBoqueo:     null,
            bloqueadoHastaAt: null,
          }),
        },
        REAGENDAR: {
          target: 'reagendado',
          actions: assign({
            motivoBoqueo:     null,
            bloqueadoHastaAt: null,
            reagendadoParaAt: ({ event }) => event.fechaNuevaAt,
            reagendadoMotivo: ({ event }) => event.motivo,
            reagendadoVeces:  ({ context }) => context.reagendadoVeces + 1,
          }),
        },
        CANCELAR: {
          target: 'cancelado',
          actions: assign({
            motivoFallo: ({ event }) => event.motivo ?? 'Cancelado mientras estaba bloqueado',
          }),
        },
      },
    },

    // ── Reagendado para una fecha/hora futura ─────────────────────────────────
    reagendado: {
      on: {
        REACTIVAR: {
          // Llegó la hora programada → vuelve a la cola
          target: 'esperando',
          actions: assign({
            reagendadoParaAt: null,
          }),
        },
        CANCELAR: {
          target: 'cancelado',
          actions: assign({
            motivoFallo: ({ event }) => event.motivo ?? 'Cancelado tras reagendamiento',
          }),
        },
      },
    },

    // ── Estados terminales ────────────────────────────────────────────────────

    completado: {
      type: 'final',
    },

    cancelado: {
      type: 'final',
    },

    fallido_definitivo: {
      type: 'final',
    },
  },
})

// ── Helper: mapear estado de la máquina al estado de delivery_queue ───────────

export function estadoQueueADB(estado: string): string {
  const mapa: Record<string, string> = {
    esperando:          'esperando',
    asignado:           'asignado',
    en_ruta:            'en_ruta',
    fallido:            'fallido',
    bloqueado:          'esperando',  // en BD se representa con bloqueado_hasta
    reagendado:         'reagendado',
    completado:         'completado',
    cancelado:          'cancelado',
    fallido_definitivo: 'fallido',
  }
  return mapa[estado] ?? 'esperando'
}

// ── Helper: ¿puede este ítem ser procesado ahora? ────────────────────────────

export function puedeProcessar(context: QueueItemContext): boolean {
  if (context.bloqueadoHastaAt) {
    return new Date() >= new Date(context.bloqueadoHastaAt)
  }
  if (context.reagendadoParaAt) {
    return new Date() >= new Date(context.reagendadoParaAt)
  }
  return true
}
