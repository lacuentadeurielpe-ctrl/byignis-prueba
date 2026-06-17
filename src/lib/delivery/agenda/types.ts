/**
 * Tipos del módulo Agenda de entregas (ventanas declaradas por el repartidor).
 *
 * Factorizado: estos tipos no dependen de Supabase ni de la UI. La capa pura
 * (`ventanas.ts`) trabaja con `Date`; la persistencia (`repository.ts`) traduce
 * a/desde los `TIMESTAMPTZ` (string ISO) de la base de datos.
 */

import type { OrigenVentana } from '@/types/entregas'

export type { OrigenVentana }

/** Una ventana de entrega: intervalo inicio–fin, su origen y si está confirmada. */
export interface VentanaEntrega {
  inicio: Date
  fin: Date
  origen: OrigenVentana
  confirmada: boolean
}

/** Un bloque en la agenda de un vehículo = una entrega ocupando una ventana. */
export interface BloqueAgenda {
  entregaId: string
  pedidoId: string
  numeroPedido: string
  vehiculoId: string | null
  estado: string
  ventana: VentanaEntrega
  /** Viaje al que pertenece (multi_reparto_id) si fue agrupado. */
  viajeId?: string | null
  /** Posición dentro del viaje agrupado. */
  posicion?: number | null
}

/** La agenda de un vehículo para un día: sus bloques ordenados por inicio. */
export interface AgendaVehiculo {
  vehiculoId: string
  fecha: string // YYYY-MM-DD (Lima)
  bloques: BloqueAgenda[]
}
