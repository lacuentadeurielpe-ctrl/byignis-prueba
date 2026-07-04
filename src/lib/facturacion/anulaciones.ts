// Procesa las anulaciones solicitadas (Fase 2 del plan de facturación automática).
//
// Este módulo NUNCA lo llama el usuario directamente — lo invoca el job nocturno
// (Inngest). Boletas se anulan con un Resumen Diario de baja (RC, status '3');
// facturas con una Comunicación de Baja (RA / documento Voided de Greenter).
// Ambos son asíncronos: se envían, y su CDR se confirma en una pasada posterior
// (`consultarTicketsPendientes`).
//
// Regla SUNAT: la baja de un documento solo puede comunicarse a partir del día
// siguiente a su emisión. Por eso ambas funciones excluyen las anulaciones cuyo
// comprobante fue emitido HOY — quedan pendientes hasta la próxima corrida.

import { mapearResumenBaja, mapearComunicacionBaja } from './lycet/mappers'
import { enviarSummary, consultarSummary, enviarVoided, consultarVoided } from './lycet/client'
import { getLycetConfig } from './lycet/config'
import { cargarCredencialesSunat } from './lycet/credenciales'
import { obtenerFerreteria, buildEmisor, registrarEmpresaEnLycet, escribirLog, fechaEmisionHoy } from './lycet/comun'

function esAceptado(cdrCodigo: string | null): boolean {
  if (cdrCodigo === '0') return true
  const n = cdrCodigo != null && /^\d+$/.test(cdrCodigo) ? parseInt(cdrCodigo, 10) : NaN
  return !Number.isNaN(n) && n >= 4000
}

export interface ResumenProcesamiento {
  ferreteriaId: string
  enviados:     number
  aceptados:    number
  rechazados:   number
  error?:       string
}

// ── Boletas: RC de baja ────────────────────────────────────────────────────────
export async function procesarBajasBoletas(supabase: any, ferreteriaId: string): Promise<ResumenProcesamiento> {
  const resumen: ResumenProcesamiento = { ferreteriaId, enviados: 0, aceptados: 0, rechazados: 0 }
  const hoy = fechaEmisionHoy()

  // Solo boletas anuladas cuya emisión NO fue hoy (regla SUNAT: baja al día siguiente)
  const { data: boletas } = await supabase
    .from('comprobantes')
    .select('id, serie, numero, subtotal, igv, total, fecha_emision')
    .eq('ferreteria_id', ferreteriaId)
    .eq('tipo', 'boleta')
    .eq('anulacion_solicitada', true)
    .not('estado_sunat', 'in', '(anulado,baja,baja_pendiente)')
    .lt('fecha_emision', hoy)

  if (!boletas || boletas.length === 0) return resumen

  const creds = await cargarCredencialesSunat(supabase, ferreteriaId)
  if (!creds) { resumen.error = 'Credenciales SUNAT no disponibles'; return resumen }

  let lycetCfg
  try { lycetCfg = getLycetConfig() } catch (e) { resumen.error = (e as Error).message; return resumen }

  const ferreteria = await obtenerFerreteria(supabase, ferreteriaId)
  if (!ferreteria) { resumen.error = 'Negocio no encontrado'; return resumen }

  const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
  if (!ensureRes.ok) { resumen.error = ensureRes.error; return resumen }

  const { count: rcHoy } = await supabase
    .from('sunat_resumenes_diarios')
    .select('id', { count: 'exact', head: true })
    .eq('ferreteria_id', ferreteriaId)
    .eq('fecha', hoy)
  const correlativo = (rcHoy ?? 0) + 1

  const doc = mapearResumenBaja(hoy, correlativo, buildEmisor(ferreteria, creds), boletas.map((b: any) => ({
    serie: b.serie, numero: b.numero, subtotal: b.subtotal ?? 0, igv: b.igv ?? 0, total: b.total ?? 0,
  })))

  const resultado = await enviarSummary(lycetCfg, doc)
  await escribirLog(supabase, ferreteriaId, null, 'baja', 'summary/send (baja)', resultado, { correlativo, boletas: boletas.length })

  if (!resultado.ok) { resumen.error = resultado.error ?? 'Error enviando RC de baja'; return resumen }

  const { data: rc } = await supabase
    .from('sunat_resumenes_diarios')
    .insert({
      ferreteria_id:  ferreteriaId,
      fecha:          hoy,
      correlativo,
      ticket:         resultado.ticket ?? null,
      estado:         'enviado',
      tipo:           'baja',
      boletas_count:  boletas.length,
      boletas_total:  boletas.reduce((a: number, b: any) => a + (b.total ?? 0), 0),
    })
    .select('id')
    .single()

  if (rc?.id) {
    await supabase.from('comprobantes')
      .update({ estado_sunat: 'baja_pendiente', rc_id: rc.id })
      .in('id', boletas.map((b: any) => b.id))
  }

  resumen.enviados = boletas.length
  return resumen
}

// ── Facturas: Comunicación de Baja (RA / Voided) ──────────────────────────────
export async function procesarBajasFacturas(supabase: any, ferreteriaId: string): Promise<ResumenProcesamiento> {
  const resumen: ResumenProcesamiento = { ferreteriaId, enviados: 0, aceptados: 0, rechazados: 0 }
  const hoy = fechaEmisionHoy()

  const { data: facturas } = await supabase
    .from('comprobantes')
    .select('id, serie, numero, fecha_emision, anulacion_motivo')
    .eq('ferreteria_id', ferreteriaId)
    .eq('tipo', 'factura')
    .eq('anulacion_solicitada', true)
    .not('estado_sunat', 'in', '(anulado,baja,baja_pendiente)')
    .lt('fecha_emision', hoy)

  if (!facturas || facturas.length === 0) return resumen

  const creds = await cargarCredencialesSunat(supabase, ferreteriaId)
  if (!creds) { resumen.error = 'Credenciales SUNAT no disponibles'; return resumen }

  let lycetCfg
  try { lycetCfg = getLycetConfig() } catch (e) { resumen.error = (e as Error).message; return resumen }

  const ferreteria = await obtenerFerreteria(supabase, ferreteriaId)
  if (!ferreteria) { resumen.error = 'Negocio no encontrado'; return resumen }

  const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
  if (!ensureRes.ok) { resumen.error = ensureRes.error; return resumen }

  // La RA agrupa por fecha de generación (todas las facturas del mismo día emitido)
  const porFecha = new Map<string, typeof facturas>()
  for (const f of facturas) {
    const grupo = porFecha.get(f.fecha_emision) ?? []
    grupo.push(f)
    porFecha.set(f.fecha_emision, grupo)
  }

  for (const [fechaGeneracion, grupo] of porFecha) {
    const { count: bajaHoy } = await supabase
      .from('sunat_comunicaciones_baja')
      .select('id', { count: 'exact', head: true })
      .eq('ferreteria_id', ferreteriaId)
      .eq('fecha', hoy)
    const correlativo = (bajaHoy ?? 0) + 1

    const doc = mapearComunicacionBaja(hoy, fechaGeneracion, correlativo, buildEmisor(ferreteria, creds),
      grupo.map((f: any) => ({ tipoDoc: '01', serie: f.serie, correlativo: f.numero, motivo: f.anulacion_motivo || 'Anulación solicitada' })))

    const resultado = await enviarVoided(lycetCfg, doc)
    await escribirLog(supabase, ferreteriaId, null, 'baja', 'voided/send', resultado, { correlativo, facturas: grupo.length })

    if (!resultado.ok) { resumen.error = resultado.error ?? 'Error enviando RA'; continue }

    const { data: baja } = await supabase
      .from('sunat_comunicaciones_baja')
      .insert({
        ferreteria_id:      ferreteriaId,
        fecha:              hoy,
        correlativo,
        ticket:             resultado.ticket ?? null,
        estado:             'enviado',
        comprobantes_count: grupo.length,
      })
      .select('id')
      .single()

    if (baja?.id) {
      await supabase.from('comprobantes')
        .update({ estado_sunat: 'baja_pendiente', comunicacion_baja_id: baja.id })
        .in('id', grupo.map((f: any) => f.id))
    }
    resumen.enviados += grupo.length
  }

  return resumen
}

// ── Consultar tickets pendientes (ambos flujos) ───────────────────────────────
// Los RC/RA son asíncronos: SUNAT devuelve un ticket que hay que consultar
// después. Esta función revisa los "enviado" de días anteriores y actualiza
// el CDR — si SUNAT aceptó, marca los comprobantes como `anulado`; si rechazó,
// libera `anulacion_solicitada` para que el dueño decida (reintentar, etc.).
export async function consultarTicketsPendientes(supabase: any, ferreteriaId: string): Promise<void> {
  const creds = await cargarCredencialesSunat(supabase, ferreteriaId)
  if (!creds) return
  let lycetCfg
  try { lycetCfg = getLycetConfig() } catch { return }

  // RCs de boletas
  const { data: rcsPendientes } = await supabase
    .from('sunat_resumenes_diarios')
    .select('id, ticket')
    .eq('ferreteria_id', ferreteriaId)
    .eq('tipo', 'baja')
    .eq('estado', 'enviado')
    .not('ticket', 'is', null)

  for (const rc of rcsPendientes ?? []) {
    const resultado = await consultarSummary(lycetCfg, rc.ticket, creds.ruc)
    if (!resultado.ok) continue
    const aceptado = esAceptado(resultado.cdrCodigo)
    await supabase.from('sunat_resumenes_diarios').update({
      estado: aceptado ? 'aceptado' : 'rechazado',
      cdr_codigo: resultado.cdrCodigo, cdr_descripcion: resultado.cdrDescripcion,
      consultado_at: new Date().toISOString(),
    }).eq('id', rc.id)

    if (aceptado) {
      await supabase.from('comprobantes')
        .update({ estado: 'anulado', estado_sunat: 'anulado' })
        .eq('rc_id', rc.id)
    } else {
      await supabase.from('comprobantes')
        .update({ anulacion_solicitada: false, estado_sunat: 'aceptado', requiere_atencion: true, ultimo_error_sunat: resultado.cdrDescripcion })
        .eq('rc_id', rc.id)
    }
  }

  // RAs de facturas
  const { data: rasPendientes } = await supabase
    .from('sunat_comunicaciones_baja')
    .select('id, ticket')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'enviado')
    .not('ticket', 'is', null)

  for (const ra of rasPendientes ?? []) {
    const resultado = await consultarVoided(lycetCfg, ra.ticket, creds.ruc)
    if (!resultado.ok) continue
    const aceptado = esAceptado(resultado.cdrCodigo)
    await supabase.from('sunat_comunicaciones_baja').update({
      estado: aceptado ? 'aceptado' : 'rechazado',
      cdr_codigo: resultado.cdrCodigo, cdr_descripcion: resultado.cdrDescripcion,
      consultado_at: new Date().toISOString(),
    }).eq('id', ra.id)

    if (aceptado) {
      await supabase.from('comprobantes')
        .update({ estado: 'anulado', estado_sunat: 'anulado' })
        .eq('comunicacion_baja_id', ra.id)
    } else {
      await supabase.from('comprobantes')
        .update({ anulacion_solicitada: false, estado_sunat: 'aceptado', requiere_atencion: true, ultimo_error_sunat: resultado.cdrDescripcion })
        .eq('comunicacion_baja_id', ra.id)
    }
  }
}
