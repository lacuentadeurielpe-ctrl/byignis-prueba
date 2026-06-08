/**
 * Cliente Inngest compartido — usado por las funciones y el route handler.
 *
 * Variables de entorno requeridas (Vercel + Inngest Dashboard):
 *   INNGEST_EVENT_KEY      — clave para enviar eventos (inngest.send)
 *   INNGEST_SIGNING_KEY    — firma para verificar callbacks (solo producción)
 *
 * En desarrollo local, Inngest Dev Server (npx inngest-cli@latest dev)
 * funciona sin variables — auto-detecta el modo local.
 */

import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'ferrobot',
  name: 'FerroBot',
})

// ── Tipos de eventos ─────────────────────────────────────────────────────────
// Centralizar los event types evita typos y da autocompletion.

export type InngestEvents = {
  /** Repartidor marcó un pedido como "enviado" → armar temporizador de retraso */
  'delivery/pedido.enviado': {
    data: {
      ferreteriaId: string
      pedidoId: string
      entregaId: string
      numeroPedido: string
      etaMinutos: number
      telefonoCliente: string | null
      telefonoWhatsapp: string | null
      nombreFerreteria: string
      repartidorNombre: string
    }
  }

  /** Pedido retornado, cancelado o fallido → recalcular ETAs de cola */
  'delivery/cola.changed': {
    data: {
      ferreteriaId: string
      motivo: 'retorno' | 'cancelado' | 'entregado'
      pedidoId: string
    }
  }

  /** ETA de un pedido cambió (re-predicción) */
  'delivery/eta.updated': {
    data: {
      ferreteriaId: string
      pedidoId: string
      etaMinutos: number
      source: string
    }
  }
}
