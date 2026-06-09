/**
 * Driver State Machine — Máquina de estados del repartidor
 *
 * Estados del repartidor durante el ciclo de vida operativo:
 *
 *   fuera_turno ──→ disponible ──→ en_ruta ──→ entre_paradas ──→ completado
 *                       │               │              │
 *                       ↓               ↓              ↓
 *                     pausa          averia        emergencia
 *                                      │
 *                                   no_disponible
 *
 * Transiciones automáticas activadas por eventos del sistema:
 *   - INICIAR_TURNO       : fuera_turno → disponible
 *   - ASIGNAR_ENTREGA     : disponible → en_ruta
 *   - LLEGAR_PARADA       : en_ruta → entre_paradas
 *   - COMPLETAR_PARADA    : entre_paradas → en_ruta (quedan más) | disponible (última)
 *   - TOMAR_PAUSA         : disponible | en_ruta → pausa
 *   - REANUDAR            : pausa → estado anterior
 *   - REPORTAR_AVERIA     : en_ruta | entre_paradas → averia
 *   - RESOLVER_AVERIA     : averia → disponible
 *   - EMERGENCIA_PERSONAL : cualquier estado → emergencia
 *   - VOLVER_DISPONIBLE   : emergencia → disponible
 *   - FINALIZAR_TURNO     : disponible | pausa → fuera_turno
 */

import { createMachine, assign } from 'xstate'

// ── Context ───────────────────────────────────────────────────────────────────

export interface DriverContext {
  repartidorId:          string
  ferreteriaId:          string
  estadoAnterior:        string | null  // para reanudar después de pausa
  entregaActivaId:       string | null
  multiRepartoId:        string | null
  paradasRestantes:      number
  ultimaLat:             number | null
  ultimaLng:             number | null
  turnoInicioAt:         string | null
  motivoNoDisponible:    string | null
  tiempoEstimadoVuelta:  number | null  // minutos estimados para volver
  incidenteId:           string | null
}

// ── Events ────────────────────────────────────────────────────────────────────

export type DriverEvent =
  | { type: 'INICIAR_TURNO'; turnoInicioAt: string }
  | { type: 'ASIGNAR_ENTREGA'; entregaId: string; multiRepartoId?: string; paradasCount: number }
  | { type: 'LLEGAR_PARADA'; lat: number; lng: number }
  | { type: 'COMPLETAR_PARADA'; quedan: number }
  | { type: 'TOMAR_PAUSA'; motivo?: string }
  | { type: 'REANUDAR' }
  | { type: 'REPORTAR_AVERIA'; motivo: string; tiempoEstimadoMin?: number; incidenteId?: string }
  | { type: 'RESOLVER_AVERIA' }
  | { type: 'EMERGENCIA_PERSONAL'; motivo: string; tiempoEstimadoMin?: number }
  | { type: 'VOLVER_DISPONIBLE' }
  | { type: 'FINALIZAR_TURNO' }
  | { type: 'GPS_ACTUALIZADO'; lat: number; lng: number }

// ── Machine ───────────────────────────────────────────────────────────────────

export const driverMachine = createMachine({
  id:      'driver',
  initial: 'fuera_turno',
  types:   {} as { context: DriverContext; events: DriverEvent },

  context: ({ input }: { input: { repartidorId: string; ferreteriaId: string } }) => ({
    repartidorId:         input.repartidorId,
    ferreteriaId:         input.ferreteriaId,
    estadoAnterior:       null,
    entregaActivaId:      null,
    multiRepartoId:       null,
    paradasRestantes:     0,
    ultimaLat:            null,
    ultimaLng:            null,
    turnoInicioAt:        null,
    motivoNoDisponible:   null,
    tiempoEstimadoVuelta: null,
    incidenteId:          null,
  }),

  states: {
    // ── Fuera de turno ───────────────────────────────────────────────────────
    fuera_turno: {
      on: {
        INICIAR_TURNO: {
          target: 'disponible',
          actions: assign({
            turnoInicioAt: ({ event }) => event.turnoInicioAt,
          }),
        },
      },
    },

    // ── Disponible para recibir entregas ─────────────────────────────────────
    disponible: {
      on: {
        ASIGNAR_ENTREGA: {
          target: 'en_ruta',
          actions: assign({
            entregaActivaId:  ({ event }) => event.entregaId,
            multiRepartoId:   ({ event }) => event.multiRepartoId ?? null,
            paradasRestantes: ({ event }) => event.paradasCount,
          }),
        },
        TOMAR_PAUSA: {
          target: 'pausa',
          actions: assign({
            estadoAnterior:    'disponible',
            motivoNoDisponible: ({ event }) => event.motivo ?? null,
          }),
        },
        FINALIZAR_TURNO: {
          target: 'fuera_turno',
          actions: assign({
            turnoInicioAt:   null,
            entregaActivaId: null,
            multiRepartoId:  null,
          }),
        },
        EMERGENCIA_PERSONAL: {
          target: 'emergencia',
          actions: assign({
            estadoAnterior:       'disponible',
            motivoNoDisponible:   ({ event }) => event.motivo,
            tiempoEstimadoVuelta: ({ event }) => event.tiempoEstimadoMin ?? null,
          }),
        },
        GPS_ACTUALIZADO: {
          actions: assign({
            ultimaLat: ({ event }) => event.lat,
            ultimaLng: ({ event }) => event.lng,
          }),
        },
      },
    },

    // ── En ruta hacia siguiente parada ───────────────────────────────────────
    en_ruta: {
      on: {
        LLEGAR_PARADA: {
          target: 'entre_paradas',
          actions: assign({
            ultimaLat: ({ event }) => event.lat,
            ultimaLng: ({ event }) => event.lng,
          }),
        },
        REPORTAR_AVERIA: {
          target: 'averia',
          actions: assign({
            estadoAnterior:       'en_ruta',
            motivoNoDisponible:   ({ event }) => event.motivo,
            tiempoEstimadoVuelta: ({ event }) => event.tiempoEstimadoMin ?? null,
            incidenteId:          ({ event }) => event.incidenteId ?? null,
          }),
        },
        EMERGENCIA_PERSONAL: {
          target: 'emergencia',
          actions: assign({
            estadoAnterior:       'en_ruta',
            motivoNoDisponible:   ({ event }) => event.motivo,
            tiempoEstimadoVuelta: ({ event }) => event.tiempoEstimadoMin ?? null,
          }),
        },
        GPS_ACTUALIZADO: {
          actions: assign({
            ultimaLat: ({ event }) => event.lat,
            ultimaLng: ({ event }) => event.lng,
          }),
        },
      },
    },

    // ── Entre paradas (gestionando entrega en puerta) ────────────────────────
    entre_paradas: {
      on: {
        COMPLETAR_PARADA: [
          {
            // Quedan más paradas → volver a en_ruta
            guard: ({ event }) => event.quedan > 0,
            target: 'en_ruta',
            actions: assign({
              paradasRestantes: ({ event }) => event.quedan,
            }),
          },
          {
            // Última parada → repartidor disponible de nuevo
            target: 'disponible',
            actions: assign({
              entregaActivaId:  null,
              multiRepartoId:   null,
              paradasRestantes: 0,
            }),
          },
        ],
        REPORTAR_AVERIA: {
          target: 'averia',
          actions: assign({
            estadoAnterior:       'entre_paradas',
            motivoNoDisponible:   ({ event }) => event.motivo,
            tiempoEstimadoVuelta: ({ event }) => event.tiempoEstimadoMin ?? null,
            incidenteId:          ({ event }) => event.incidenteId ?? null,
          }),
        },
        EMERGENCIA_PERSONAL: {
          target: 'emergencia',
          actions: assign({
            estadoAnterior:       'entre_paradas',
            motivoNoDisponible:   ({ event }) => event.motivo,
            tiempoEstimadoVuelta: ({ event }) => event.tiempoEstimadoMin ?? null,
          }),
        },
        GPS_ACTUALIZADO: {
          actions: assign({
            ultimaLat: ({ event }) => event.lat,
            ultimaLng: ({ event }) => event.lng,
          }),
        },
      },
    },

    // ── En pausa voluntaria ──────────────────────────────────────────────────
    pausa: {
      on: {
        REANUDAR: [
          {
            guard: ({ context }) => context.estadoAnterior === 'en_ruta',
            target: 'en_ruta',
            actions: assign({ estadoAnterior: null }),
          },
          {
            target: 'disponible',
            actions: assign({ estadoAnterior: null }),
          },
        ],
        FINALIZAR_TURNO: {
          target: 'fuera_turno',
          actions: assign({ turnoInicioAt: null, estadoAnterior: null }),
        },
        EMERGENCIA_PERSONAL: {
          target: 'emergencia',
          actions: assign({
            estadoAnterior:       'pausa',
            motivoNoDisponible:   ({ event }) => event.motivo,
            tiempoEstimadoVuelta: ({ event }) => event.tiempoEstimadoMin ?? null,
          }),
        },
      },
    },

    // ── Avería de vehículo (no se puede mover) ───────────────────────────────
    averia: {
      on: {
        RESOLVER_AVERIA: {
          target: 'disponible',
          actions: assign({
            estadoAnterior:       null,
            motivoNoDisponible:   null,
            tiempoEstimadoVuelta: null,
            incidenteId:          null,
          }),
        },
        EMERGENCIA_PERSONAL: {
          target: 'emergencia',
          actions: assign({
            motivoNoDisponible:   ({ event }) => event.motivo,
            tiempoEstimadoVuelta: ({ event }) => event.tiempoEstimadoMin ?? null,
          }),
        },
      },
    },

    // ── Emergencia personal (máxima prioridad) ───────────────────────────────
    emergencia: {
      on: {
        VOLVER_DISPONIBLE: {
          target: 'disponible',
          actions: assign({
            estadoAnterior:       null,
            motivoNoDisponible:   null,
            tiempoEstimadoVuelta: null,
          }),
        },
        FINALIZAR_TURNO: {
          target: 'fuera_turno',
          actions: assign({
            estadoAnterior:       null,
            motivoNoDisponible:   null,
            turnoInicioAt:        null,
          }),
        },
      },
    },
  },
})

// ── Helper: mapear estado de la máquina al estado_operativo de la BD ──────────

export function estadoMaquinaADB(estado: string): string {
  const mapa: Record<string, string> = {
    fuera_turno:    'fuera_turno',
    disponible:     'disponible',
    en_ruta:        'en_ruta',
    entre_paradas:  'entre_paradas',
    pausa:          'pausa',
    averia:         'averia',
    emergencia:     'emergencia',
  }
  return mapa[estado] ?? 'no_disponible'
}
