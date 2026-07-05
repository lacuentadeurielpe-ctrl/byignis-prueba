// Carga y desencripta las credenciales SUNAT Directo de un tenant.
// Compartido por el adapter de emisión, el job de reintentos y el de anulaciones —
// evita que cada uno reimplemente la conversión PFX→PEM y su persistencia en caliente.

import { desencriptar, encriptar } from '@/lib/encryption'
import { pfxAPem } from './cert'

export interface CredencialesSunat {
  ruc:         string
  razonSocial: string
  solUsuario:  string
  solClave:    string
  certPem:     string   // certificado + clave privada PEM (lo que Lycet necesita)
  modo:        'beta' | 'produccion'
}

/**
 * Chequeo ligero de "¿este negocio puede emitir comprobantes electrónicos?"
 * — sin desencriptar nada. Lo usan el bot, el POS y las páginas del dashboard
 * para decidir entre nota de venta y boleta/factura.
 */
export async function tieneFacturacionActiva(supabase: any, ferreteriaId: string): Promise<boolean> {
  const { data } = await supabase
    .from('sunat_credenciales')
    .select('id')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'activo')
    .maybeSingle()
  return !!data
}

export async function cargarCredencialesSunat(supabase: any, ferreteriaId: string): Promise<CredencialesSunat | null> {
  const { data } = await supabase
    .from('sunat_credenciales')
    .select('ruc, razon_social, sol_usuario_enc, sol_clave_enc, cert_pfx_enc, cert_clave_enc, cert_pem_enc, modo')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'activo')
    .single()

  if (!data) return null

  try {
    const [solUsuario, solClave] = await Promise.all([
      desencriptar(data.sol_usuario_enc),
      desencriptar(data.sol_clave_enc),
    ])

    let certPem: string

    if (data.cert_pem_enc) {
      // Ruta óptima: PEM ya almacenado (no hay que convertir cada vez)
      certPem = await desencriptar(data.cert_pem_enc)
    } else {
      // Migración en caliente: usuario con credenciales previas sin PEM guardado.
      // Convierte PFX → PEM y lo persiste para la próxima vez.
      const [certPfxB64, certClave] = await Promise.all([
        desencriptar(data.cert_pfx_enc),
        desencriptar(data.cert_clave_enc),
      ])
      const convertido = pfxAPem(certPfxB64, certClave)
      certPem = convertido.pem
      // Persiste de forma asíncrona; si falla no bloquea la emisión
      encriptar(certPem)
        .then(enc =>
          supabase.from('sunat_credenciales').update({
            cert_pem_enc:  enc,
            cert_vence_at: convertido.venceAt.toISOString(),
          }).eq('ferreteria_id', ferreteriaId),
        )
        .catch(() => {})
    }

    return {
      ruc:         data.ruc,
      razonSocial: data.razon_social,
      solUsuario,
      solClave,
      certPem,
      modo: data.modo,
    }
  } catch {
    return null
  }
}
