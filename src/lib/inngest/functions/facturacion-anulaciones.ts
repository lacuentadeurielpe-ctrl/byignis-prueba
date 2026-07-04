/**
 * Inngest Function: facturacion/anulaciones
 *
 * Fase 2 del plan de facturación automática: procesa las anulaciones que el
 * dueño solicitó desde el dashboard. Corre una vez al día (10am Lima, después
 * de que las boletas de ayer ya puedan darse de baja según la regla SUNAT de
 * "un día después de la emisión"). Agrupa por negocio, envía el RC de baja
 * (boletas) y la Comunicación de Baja (facturas), y consulta los tickets
 * pendientes de corridas anteriores.
 */

import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import { procesarBajasBoletas, procesarBajasFacturas, consultarTicketsPendientes } from '@/lib/facturacion/anulaciones'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const fnFacturacionAnulaciones = inngest.createFunction(
  {
    id:      'facturacion-anulaciones',
    name:    'Procesar anulaciones pendientes (RC/RA)',
    retries: 1,
    triggers: [{ cron: 'TZ=America/Lima 0 10 * * *' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: { step: any }) => {
    const ferreterias = await step.run('cargar-ferreterias', async () => {
      const supabase = adminClient()
      const { data } = await supabase
        .from('ferreterias')
        .select('id, nombre')
        .eq('proveedor_facturacion', 'sunat_directo')
      return data ?? []
    })

    const resultados: any[] = []
    for (const f of ferreterias) {
      const r = await step.run(`procesar-${f.id}`, async () => {
        const supabase = adminClient()
        const [boletas, facturas] = await Promise.all([
          procesarBajasBoletas(supabase, f.id),
          procesarBajasFacturas(supabase, f.id),
        ])
        await consultarTicketsPendientes(supabase, f.id)
        return { ferreteria: f.nombre, boletas, facturas }
      })
      resultados.push(r)
    }

    return { procesadas: resultados.length, resultados }
  },
)
