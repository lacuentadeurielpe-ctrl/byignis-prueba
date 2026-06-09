/**
 * Vehicle State Machine — Máquina de estados del vehículo
 *
 * Estados del vehículo durante su ciclo de vida operativo:
 *
 *   disponible ──→ en_uso ──→ disponible
 *       │              │
 *       ↓              ↓
 *   averia_leve    averia_grave
 *       │              │
 *       ↓              ↓
 *   mantenimiento  fuera_servicio
 *       │
 *       ↓
 *   disponible
 *
 * Transiciones:
 *   - ASIGNAR          : disponible → en_uso
 *   - LIBERAR          : en_uso → disponible
 *   - REPORTAR_AVERIA  : disponible | en_uso → averia_leve | averia_grave
 *   - INICIAR_MANT     : averia_leve → mantenimiento
 *   - COMPLETAR_MANT   : mantenimiento → disponible
 *   - AVERIA_GRAVE     : averia_leve → averia_grave
 *   - DAR_BAJA         : averia_grave → fuera_servicio
 *   - REHABILITAR      : fuera_servicio → disponible
 */

import { createMachine, assign } from 'xstate'

// ── Context ───────────────────────────────────────────────────────────────────

export interface VehicleContext {
  vehiculoId:           string
  ferreteriaId:         string
  tipo:                 string           // moto | auto | bicicleta | camion
  capacidadKg:          number
  velocidadKmh:         number
  repartidorActualId:   string | null
  descripcionAveria:    string | null
  estResolucionAt:      string | null    // ISO timestamp estimado de resolución
  enUsoDesdeAt:         string | null
  totalKmRecorridos:    number
  entregasCompletadas:  number
}

// ── Events ────────────────────────────────────────────────────────────────────

export type VehicleEvent =
  | { type: 'ASIGNAR'; repartidorId: string }
  | { type: 'LIBERAR' }
  | { type: 'REPORTAR_AVERIA'; descripcion: string; grave: boolean; estResolucionAt?: string }
  | { type: 'AVERIA_SE_AGRAVA'; descripcion?: string; estResolucionAt?: string }
  | { type: 'INICIAR_MANTENIMIENTO'; estResolucionAt?: string }
  | { type: 'COMPLETAR_MANTENIMIENTO' }
  | { type: 'DAR_BAJA'; motivo: string }
  | { type: 'REHABILITAR' }
  | { type: 'REGISTRAR_KM'; km: number }
  | { type: 'REGISTRAR_ENTREGA' }

// ── Machine ───────────────────────────────────────────────────────────────────

export const vehicleMachine = createMachine({
  id:      'vehicle',
  initial: 'disponible',
  types:   {} as { context: VehicleContext; events: VehicleEvent },

  context: ({ input }: {
    input: {
      vehiculoId:   string
      ferreteriaId: string
      tipo?:        string
      capacidadKg?: number
      velocidadKmh?: number
    }
  }) => ({
    vehiculoId:          input.vehiculoId,
    ferreteriaId:        input.ferreteriaId,
    tipo:                input.tipo         ?? 'moto',
    capacidadKg:         input.capacidadKg  ?? 80,
    velocidadKmh:        input.velocidadKmh ?? 35,
    repartidorActualId:  null,
    descripcionAveria:   null,
    estResolucionAt:     null,
    enUsoDesdeAt:        null,
    totalKmRecorridos:   0,
    entregasCompletadas: 0,
  }),

  states: {
    // ── Disponible para asignación ───────────────────────────────────────────
    disponible: {
      on: {
        ASIGNAR: {
          target: 'en_uso',
          actions: assign({
            repartidorActualId: ({ event }) => event.repartidorId,
            enUsoDesdeAt:       () => new Date().toISOString(),
          }),
        },
        REPORTAR_AVERIA: [
          {
            guard: ({ event }) => event.grave,
            target: 'averia_grave',
            actions: assign({
              descripcionAveria: ({ event }) => event.descripcion,
              estResolucionAt:   ({ event }) => event.estResolucionAt ?? null,
            }),
          },
          {
            target: 'averia_leve',
            actions: assign({
              descripcionAveria: ({ event }) => event.descripcion,
              estResolucionAt:   ({ event }) => event.estResolucionAt ?? null,
            }),
          },
        ],
        REGISTRAR_KM: {
          actions: assign({
            totalKmRecorridos: ({ context, event }) => context.totalKmRecorridos + event.km,
          }),
        },
      },
    },

    // ── En uso por un repartidor ─────────────────────────────────────────────
    en_uso: {
      on: {
        LIBERAR: {
          target: 'disponible',
          actions: assign({
            repartidorActualId: null,
            enUsoDesdeAt:       null,
          }),
        },
        REPORTAR_AVERIA: [
          {
            guard: ({ event }) => event.grave,
            target: 'averia_grave',
            actions: assign({
              descripcionAveria:  ({ event }) => event.descripcion,
              estResolucionAt:    ({ event }) => event.estResolucionAt ?? null,
              repartidorActualId: null,
              enUsoDesdeAt:       null,
            }),
          },
          {
            target: 'averia_leve',
            actions: assign({
              descripcionAveria:  ({ event }) => event.descripcion,
              estResolucionAt:    ({ event }) => event.estResolucionAt ?? null,
              repartidorActualId: null,
              enUsoDesdeAt:       null,
            }),
          },
        ],
        REGISTRAR_KM: {
          actions: assign({
            totalKmRecorridos: ({ context, event }) => context.totalKmRecorridos + event.km,
          }),
        },
        REGISTRAR_ENTREGA: {
          actions: assign({
            entregasCompletadas: ({ context }) => context.entregasCompletadas + 1,
          }),
        },
      },
    },

    // ── Avería leve (reparable en campo o taller rápido) ─────────────────────
    averia_leve: {
      on: {
        INICIAR_MANTENIMIENTO: {
          target: 'mantenimiento',
          actions: assign({
            estResolucionAt: ({ event }) => event.estResolucionAt ?? null,
          }),
        },
        COMPLETAR_MANTENIMIENTO: {
          // Avería leve resuelta directamente (sin taller formal)
          target: 'disponible',
          actions: assign({
            descripcionAveria: null,
            estResolucionAt:   null,
          }),
        },
        AVERIA_SE_AGRAVA: {
          target: 'averia_grave',
          actions: assign({
            descripcionAveria: ({ context, event }) =>
              event.descripcion ?? context.descripcionAveria,
            estResolucionAt: ({ event }) => event.estResolucionAt ?? null,
          }),
        },
        DAR_BAJA: {
          target: 'fuera_servicio',
          actions: assign({
            descripcionAveria: ({ event }) => event.motivo,
          }),
        },
      },
    },

    // ── Avería grave (requiere taller / grúa) ────────────────────────────────
    averia_grave: {
      on: {
        INICIAR_MANTENIMIENTO: {
          target: 'mantenimiento',
          actions: assign({
            estResolucionAt: ({ event }) => event.estResolucionAt ?? null,
          }),
        },
        DAR_BAJA: {
          target: 'fuera_servicio',
          actions: assign({
            descripcionAveria: ({ event }) => event.motivo,
          }),
        },
      },
    },

    // ── En mantenimiento programado ──────────────────────────────────────────
    mantenimiento: {
      on: {
        COMPLETAR_MANTENIMIENTO: {
          target: 'disponible',
          actions: assign({
            descripcionAveria: null,
            estResolucionAt:   null,
          }),
        },
        DAR_BAJA: {
          target: 'fuera_servicio',
          actions: assign({
            descripcionAveria: ({ event }) => event.motivo,
          }),
        },
      },
    },

    // ── Fuera de servicio definitivo ─────────────────────────────────────────
    fuera_servicio: {
      on: {
        REHABILITAR: {
          target: 'disponible',
          actions: assign({
            descripcionAveria: null,
            estResolucionAt:   null,
          }),
        },
      },
    },
  },
})

// ── Helper: mapear estado de la máquina al estado de la BD ───────────────────

export function estadoVehiculoADB(estado: string): string {
  const mapa: Record<string, string> = {
    disponible:      'disponible',
    en_uso:          'en_uso',
    averia_leve:     'averia_leve',
    averia_grave:    'averia_grave',
    mantenimiento:   'mantenimiento',
    fuera_servicio:  'fuera_servicio',
  }
  return mapa[estado] ?? 'disponible'
}

// ── Helper: ¿el vehículo puede llevar este peso? ─────────────────────────────

export function puedeCargarPeso(context: VehicleContext, pesoKg: number): boolean {
  return context.capacidadKg >= pesoKg
}
