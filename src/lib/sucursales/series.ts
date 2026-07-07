// Series de comprobantes por sucursal.
// Plan: docs/PLAN_SUCURSALES.md — FASES 2 y 3.
//
// Regla: un local puede declarar sus propias series (B002, F002…). Si no las
// declara (NULL), usa las series del tenant (ferreterias.serie_boletas /
// serie_facturas) — el comportamiento clásico. La reserva atómica de
// correlativos (sunat_series) no cambia: sigue siendo por (tenant, tipo, serie).

const RE_SERIE_BOLETA  = /^B[A-Z0-9]{3}$/
const RE_SERIE_FACTURA = /^F[A-Z0-9]{3}$/
const RE_CODIGO_SUNAT  = /^\d{4}$/

/**
 * Valida formato y unicidad de los campos SUNAT de un local (create/update).
 * Devuelve el mensaje de error, o null si todo está bien.
 */
export async function validarCamposSunatLocal(
  supabase: any,
  ferreteriaId: string,
  body: { codigo_sunat?: string; serie_boletas?: string | null; serie_facturas?: string | null },
  localIdActual: string | null,
): Promise<string | null> {
  const codigo = body.codigo_sunat?.trim()
  if (codigo && !RE_CODIGO_SUNAT.test(codigo)) {
    return 'El código de establecimiento SUNAT debe ser de 4 dígitos (ej. 0000, 0001)'
  }

  const serieB = body.serie_boletas?.trim().toUpperCase()
  if (serieB && !RE_SERIE_BOLETA.test(serieB)) {
    return 'La serie de boletas debe tener formato B + 3 caracteres (ej. B002)'
  }

  const serieF = body.serie_facturas?.trim().toUpperCase()
  if (serieF && !RE_SERIE_FACTURA.test(serieF)) {
    return 'La serie de facturas debe tener formato F + 3 caracteres (ej. F002)'
  }

  // Unicidad: ninguna serie declarada puede estar en otro local del tenant
  if (serieB || serieF) {
    let query = supabase
      .from('locales_ferreteria')
      .select('id, nombre, serie_boletas, serie_facturas')
      .eq('ferreteria_id', ferreteriaId)
    if (localIdActual) query = query.neq('id', localIdActual)
    const { data: otros } = await query

    for (const otro of otros ?? []) {
      if (serieB && (otro.serie_boletas === serieB || otro.serie_facturas === serieB)) {
        return `La serie ${serieB} ya está asignada al local "${otro.nombre}"`
      }
      if (serieF && (otro.serie_boletas === serieF || otro.serie_facturas === serieF)) {
        return `La serie ${serieF} ya está asignada al local "${otro.nombre}"`
      }
    }
  }

  return null
}

export interface SerieResuelta {
  serie: string
  /** Código de establecimiento anexo del local emisor ('0000' si no aplica). */
  codigoSunat: string
  localId: string | null
}

/**
 * Resuelve la serie a usar para emitir un comprobante desde un local.
 * Fallback en cadena: serie del local → serie del tenant → default histórico.
 * (Conectado al adapter SUNAT en la FASE 3 del plan.)
 */
export async function resolverSerie(
  supabase: any,
  ferreteriaId: string,
  tipo: 'boleta' | 'factura',
  localId: string | null,
): Promise<SerieResuelta> {
  const fallbackTenant = async (): Promise<SerieResuelta> => {
    const { data: f } = await supabase
      .from('ferreterias')
      .select('serie_boletas, serie_facturas')
      .eq('id', ferreteriaId)
      .single()
    return {
      serie: tipo === 'boleta' ? (f?.serie_boletas ?? 'B001') : (f?.serie_facturas ?? 'F001'),
      codigoSunat: '0000',
      localId: null,
    }
  }

  if (!localId) return fallbackTenant()

  const { data: local } = await supabase
    .from('locales_ferreteria')
    .select('id, codigo_sunat, serie_boletas, serie_facturas')
    .eq('id', localId)
    .eq('ferreteria_id', ferreteriaId)
    .single()

  if (!local) return fallbackTenant()

  const seriePropia = tipo === 'boleta' ? local.serie_boletas : local.serie_facturas
  if (!seriePropia) {
    const base = await fallbackTenant()
    return { ...base, codigoSunat: local.codigo_sunat ?? '0000', localId: local.id }
  }

  return { serie: seriePropia, codigoSunat: local.codigo_sunat ?? '0000', localId: local.id }
}
