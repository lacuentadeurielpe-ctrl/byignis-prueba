// Resuelve qué proveedor WhatsApp está activo para una ferretería.
// Prioridad: Meta (primario) → YCloud (secundario).
// Ambos webhooks crean el sender directamente; esta función la usa el bot
// cuando necesita enviar desde un contexto que no arrancó por un webhook
// (ej: cron de recordatorios, pedidos desde POS).

import type { SupabaseClient } from '@supabase/supabase-js'
import { desencriptar } from '@/lib/encryption'
import { crearMetaSender } from './drivers/meta-driver'
import { crearYCloudSender } from './drivers/ycloud-driver'
import type { WASender } from './types'

export async function resolverSender(
  supabase: SupabaseClient,
  ferreteriaId: string,
  telefonoFerreteria: string  // sin + (ej: 51999888777)
): Promise<WASender | null> {
  // 1. Intentar con Meta
  const { data: meta } = await supabase
    .from('configuracion_meta')
    .select('phone_number_id, access_token_enc')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado_conexion', 'activo')
    .single()

  if (meta?.access_token_enc) {
    try {
      const accessToken = await desencriptar(meta.access_token_enc)
      return crearMetaSender({
        ferreteriaId,
        telefonoFerreteria,
        phoneNumberId: meta.phone_number_id,
        accessToken,
      })
    } catch (e) {
      console.error(`[provider] Error desencriptando token Meta para ${ferreteriaId}:`, e)
    }
  }

  // 2. Fallback a YCloud
  const { data: ycloud } = await supabase
    .from('configuracion_ycloud')
    .select('api_key_enc')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado_conexion', 'activo')
    .single()

  if (ycloud?.api_key_enc) {
    try {
      const apiKey = await desencriptar(ycloud.api_key_enc)
      return crearYCloudSender({ ferreteriaId, telefonoFerreteria, apiKey })
    } catch (e) {
      console.error(`[provider] Error desencriptando api_key YCloud para ${ferreteriaId}:`, e)
    }
  }

  console.warn(`[provider] Sin proveedor WhatsApp activo para ferretería ${ferreteriaId}`)
  return null
}
