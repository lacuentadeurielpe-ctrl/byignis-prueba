/**
 * Inngest Function: facturacion/conciliacion
 *
 * Fase 3 del plan de facturación automática: cada noche el sistema se audita
 * solo — ventas sin comprobante, comprobantes que requieren atención,
 * certificado por vencer, anulaciones atascadas. Solo notifica al dueño por
 * WhatsApp si encontró algo (silencio = todo en orden).
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { detectarExcepciones } from '@/lib/facturacion/conciliacion'
import { resolverSender } from '@/lib/whatsapp/provider'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnFacturacionConciliacion = inngest.createFunction(
  {
    id:      'facturacion-conciliacion',
    name:    'Conciliación fiscal nocturna',
    retries: 1,
    triggers: [{ cron: 'TZ=America/Lima 0 1 * * *' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: { step: any }) => {
    const ferreterias = await step.run('cargar-ferreterias', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('ferreterias')
        .select('id, nombre, telefono_dueno, telefono_whatsapp')
        .eq('proveedor_facturacion', 'sunat_directo')
      return data ?? []
    })

    let notificadas = 0
    for (const f of ferreterias) {
      await step.run(`conciliar-${f.id}`, async () => {
        const supabase = adminClient()
        const { excepciones } = await detectarExcepciones(supabase, f.id)
        if (excepciones.length === 0) return { excepciones: 0 }

        if (f.telefono_dueno && f.telefono_whatsapp) {
          const sender = await resolverSender(supabase, f.id, (f.telefono_whatsapp as string).replace(/^\+/, '')).catch(() => null)
          if (sender) {
            const lineas = [
              `⚠️ *Salud fiscal — ${f.nombre}*`,
              '',
              ...excepciones.slice(0, 8).map(e => `• ${e.mensaje}`),
              '',
              '_Revisa Contabilidad → Salud Fiscal en tu panel._',
            ]
            await sender.enviarMensaje({ to: f.telefono_dueno as string, texto: lineas.join('\n') })
            notificadas++
          }
        }
        return { excepciones: excepciones.length }
      })
    }

    return { revisadas: ferreterias.length, notificadas }
  },
)
