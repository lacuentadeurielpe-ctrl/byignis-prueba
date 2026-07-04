/**
 * POST /api/inngest
 * Endpoint webhook que Inngest necesita para registrar y ejecutar funciones.
 * En desarrollo: Inngest Dev Server (npx inngest-cli@latest dev) llama aquí.
 * En producción: Inngest Cloud llama aquí con INNGEST_SIGNING_KEY para verificar.
 */

import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { fnCheckDelay } from '@/lib/inngest/functions/check-delay'
import { fnQueueRecalculate } from '@/lib/inngest/functions/queue-recalculate'
import { fnUnassignedAlert } from '@/lib/inngest/functions/unassigned-alert'
// BLOQUE 4 — Nuevos workflows de orquestación
import { fnPedidoProgramado } from '@/lib/inngest/functions/pedido-programado'
import { fnAveriaVehiculo } from '@/lib/inngest/functions/averia-vehiculo'
import { fnRepartidorEmergencia } from '@/lib/inngest/functions/repartidor-emergencia'
import { fnClienteAusente } from '@/lib/inngest/functions/cliente-ausente'
import { fnPedidoCanceladoReasignar } from '@/lib/inngest/functions/pedido-cancelado-reasignar'
import { fnMonitorDemora } from '@/lib/inngest/functions/monitor-demora'
// Facturación automática (reintentos, anulaciones, conciliación)
import { fnFacturacionReintentos } from '@/lib/inngest/functions/facturacion-reintentos'
import { fnFacturacionAnulaciones } from '@/lib/inngest/functions/facturacion-anulaciones'
import { fnFacturacionConciliacion } from '@/lib/inngest/functions/facturacion-conciliacion'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Existentes
    fnCheckDelay,
    fnQueueRecalculate,
    fnUnassignedAlert,
    // Orquestación completa de delivery
    fnPedidoProgramado,
    fnAveriaVehiculo,
    fnRepartidorEmergencia,
    fnClienteAusente,
    fnPedidoCanceladoReasignar,
    fnMonitorDemora,
    // Facturación automática
    fnFacturacionReintentos,
    fnFacturacionAnulaciones,
    fnFacturacionConciliacion,
  ],
})
