// Utilidades compartidas por el adapter de emisión, el job de reintentos y el
// de anulaciones: registrar la empresa en Lycet, reservar/liberar correlativos,
// y escribir en la bitácora sunat_log. Todo lo que toca DB + Lycet pero no es
// específico de un tipo de documento vive aquí.

import { ensureCompany, type LycetConfig, type ResultadoSunat } from './client'
import type { EmisorLycet } from './mappers'
import type { CredencialesSunat } from './credenciales'

export async function obtenerFerreteria(supabase: any, ferreteriaId: string) {
  const { data } = await supabase
    .from('ferreterias')
    .select('id, ruc, razon_social, serie_boletas, serie_facturas, igv_incluido_en_precios, direccion')
    .eq('id', ferreteriaId)
    .single()
  return data
}

export function buildEmisor(ferreteria: any, creds: CredencialesSunat): EmisorLycet {
  return {
    ruc:          creds.ruc,
    razonSocial:  creds.razonSocial,
    direccion:    ferreteria.direccion ?? '-',
    ubigeo:       '150101',
    departamento: 'LIMA',
    provincia:    'LIMA',
    distrito:     'LIMA',
  }
}

// URL beta de SUNAT para boletas/facturas (billService)
const FE_BETA_URL = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService'

export async function registrarEmpresaEnLycet(
  lycetCfg: LycetConfig,
  creds: CredencialesSunat,
): Promise<{ ok: boolean; error?: string }> {
  return ensureCompany(lycetCfg, {
    ruc:     creds.ruc,
    solUser: creds.solUsuario,
    solPass: creds.solClave,
    certPem: creds.certPem,
    feUrl:   creds.modo === 'beta' ? FE_BETA_URL : undefined,
  })
}

// ── Reserva atómica de correlativo ────────────────────────────────────────────
export async function reservarCorrelativo(
  supabase: any,
  ferreteriaId: string,
  tipoDoc: string,
  serie: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('reservar_correlativo_serie', {
    p_ferreteria_id: ferreteriaId,
    p_tipo_doc:      tipoDoc,
    p_serie:         serie,
  })
  if (error || data == null) return null
  return data as number
}

export async function rollbackCorrelativo(
  supabase: any,
  ferreteriaId: string,
  tipoDoc: string,
  serie: string,
  correlativo: number,
) {
  try {
    await supabase.rpc('rollback_correlativo_serie', {
      p_ferreteria_id: ferreteriaId,
      p_tipo_doc:      tipoDoc,
      p_serie:         serie,
      p_correlativo:   correlativo,
    })
  } catch { /* rollback best-effort */ }
}

// ── Bitácora SUNAT (no crítica — errores son silenciados) ─────────────────────
export async function escribirLog(
  supabase: any,
  ferreteriaId: string,
  comprobanteId: string | null,
  direccion: 'envio' | 'consulta' | 'resumen' | 'baja' | 'test',
  endpoint: string,
  resultado: ResultadoSunat,
  requestResumen?: any,
) {
  try {
    await supabase.from('sunat_log').insert({
      ferreteria_id:   ferreteriaId,
      comprobante_id:  comprobanteId,
      direccion,
      endpoint,
      request_resumen: requestResumen ?? null,
      response_resumen: {
        cdrCodigo:      resultado.cdrCodigo,
        cdrDescripcion: resultado.cdrDescripcion,
        cdrNotas:       resultado.cdrNotas,
        ok:             resultado.ok,
        aceptado:       resultado.aceptado,
        error:          resultado.error,
      },
      cdr_codigo:  resultado.cdrCodigo,
      http_status: resultado.ok ? 200 : 500,
      exito:       resultado.aceptado,
    })
  } catch { /* log best-effort */ }
}

export function fechaEmisionHoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

export function padCorrelativo(n: number) {
  return String(n).padStart(8, '0')
}
