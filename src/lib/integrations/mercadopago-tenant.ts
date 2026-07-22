/**
 * Acceso al token de Mercado Pago de un tenant (el que cada negocio conecta
 * para cobrar a SUS clientes) — distinto del token propio de Uintegrus que
 * vive en MP_ACCESS_TOKEN y se usa en lib/suscripciones/mercadopago.ts.
 *
 * El token se guarda cifrado (AES-256-GCM) en
 * `integraciones_conectadas.metadata.access_token_enc`, igual que YCloud,
 * Meta y SUNAT. Este helper centraliza la lectura para que ningún llamador
 * tenga que saber cómo está almacenado.
 */

import { desencriptar } from '@/lib/encryption'

/**
 * Devuelve el access token en claro, o null si el negocio no tiene la
 * integración conectada o el token no se puede descifrar.
 *
 * Compatible con registros antiguos guardados en texto plano
 * (`access_token`) — se siguen aceptando para no romper cuentas ya
 * conectadas, pero al volver a guardar quedan cifradas.
 */
export async function getAccessTokenTenantMP(
  supabase: { from: (t: string) => any },
  ferreteriaId: string,
): Promise<{ token: string | null; motivo?: 'sin_integracion' | 'sin_token' | 'error_descifrado' }> {
  const { data: integ } = await supabase
    .from('integraciones_conectadas')
    .select('metadata, estado')
    .eq('ferreteria_id', ferreteriaId)
    .eq('tipo', 'mercadopago')
    .maybeSingle()

  if (!integ || integ.estado !== 'conectado') {
    return { token: null, motivo: 'sin_integracion' }
  }

  const meta = (integ.metadata ?? {}) as Record<string, unknown>

  const cifrado = meta.access_token_enc as string | undefined
  if (cifrado) {
    try {
      return { token: await desencriptar(cifrado) }
    } catch (e) {
      console.error('[MP tenant] no se pudo descifrar el access token:', e)
      return { token: null, motivo: 'error_descifrado' }
    }
  }

  // Registro anterior al cifrado
  const plano = meta.access_token as string | undefined
  if (plano) return { token: plano }

  return { token: null, motivo: 'sin_token' }
}
