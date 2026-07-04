/**
 * Inngest Function: facturacion/reintentos
 *
 * Corazón de la Fase 1 (facturación automática): ningún comprobante debe
 * perderse por un fallo transitorio de infraestructura (Lycet/SUNAT caído,
 * timeout). Cada 15 minutos recorre los comprobantes en `error_reintentable`
 * cuyo `proximo_intento_at` ya venció y los reenvía usando el mismo adapter
 * que la emisión original (reutiliza serie/correlativo, no genera uno nuevo).
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { SunatDirectoAdapter } from '@/lib/facturacion/sunat-directo-adapter'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnFacturacionReintentos = inngest.createFunction(
  {
    id:      'facturacion-reintentos',
    name:    'Reintentar comprobantes en cola',
    retries: 0,   // cada comprobante maneja su propio reintento; no reintentar la function entera
    triggers: [{ cron: '*/15 * * * *' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: { step: any }) => {
    const pendientes = await step.run('cargar-pendientes', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('comprobantes')
        .select('id, ferreteria_id, numero_completo')
        .eq('estado_sunat', 'error_reintentable')
        .eq('requiere_atencion', false)
        .lte('proximo_intento_at', new Date().toISOString())
        .limit(50)
      return data ?? []
    })

    if (pendientes.length === 0) return { procesados: 0 }

    const adapter = new SunatDirectoAdapter()
    const resultados: Array<{ id: string; ok: boolean; error?: string }> = []

    for (const comp of pendientes) {
      const r = await step.run(`reintentar-${comp.id}`, async () => {
        const supabase = adminClient()
        const resultado = await adapter.reintentarEnvio!({
          supabase,
          comprobanteId: comp.id,
          ferreteriaId:  comp.ferreteria_id,
        })
        return { id: comp.id, ok: resultado.ok, error: resultado.error }
      })
      resultados.push(r)
    }

    return { procesados: resultados.length, exitosos: resultados.filter(r => r.ok).length }
  },
)
