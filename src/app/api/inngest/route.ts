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

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fnCheckDelay,
    fnQueueRecalculate,
    fnUnassignedAlert,
  ],
})
