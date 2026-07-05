// Adaptador SUNAT Directo → interfaz ProveedorFacturacion
// Motor: Lycet (REST API oficial de Greenter — github.com/giansalex/lycet)
//
// Lycet recibe JSON, construye el XML UBL 2.1, lo firma con el certificado PEM
// y lo envía a SUNAT vía SOAP. Configura la empresa una vez por emisión (idempotente).
//
// Variables de entorno requeridas en Vercel + Railway:
//   LYCET_BASE_URL — URL del servicio Lycet desplegado en Railway
//   LYCET_API_TOKEN — token de autenticación del servicio Lycet

import { crearNotaVentaInterna } from '@/lib/comprobantes/nota-venta'
import {
  mapearInvoice, mapearNota,
  type ClienteLycet, type ItemLycet,
} from './lycet/mappers'
import {
  enviarInvoice, enviarNota,
  type LycetConfig, type ResultadoSunat,
} from './lycet/client'
import { getLycetConfig } from './lycet/config'
import { cargarCredencialesSunat } from './lycet/credenciales'
import {
  obtenerFerreteria, buildEmisor, registrarEmpresaEnLycet,
  reservarCorrelativo, rollbackCorrelativo, escribirLog,
  fechaEmisionHoy, padCorrelativo,
} from './lycet/comun'
import type {
  ProveedorFacturacion,
  OpcionesEmisionBoleta,
  OpcionesEmisionFactura,
  OpcionesNotaCredito,
  OpcionesReintentoEnvio,
  OpcionesSolicitarAnulacion,
  ResultadoAnulacion,
  ResultadoEmisionUnificado,
} from './types'

async function mapearItemsDePedido(supabase: any, pedidoId: string): Promise<any[]> {
  const { data } = await supabase
    .from('pedidos')
    .select('items_pedido(nombre_producto, cantidad, precio_unitario, unidad, productos(facturable))')
    .eq('id', pedidoId)
    .single()
  return data?.items_pedido ?? []
}

// ── Conversión a formato Lycet ────────────────────────────────────────────────
function toItemsLycet(items: any[]): ItemLycet[] {
  return items.map((i: any) => ({
    descripcion:    i.nombre_producto ?? 'Producto',
    cantidad:       Number(i.cantidad) || 1,
    precioUnitario: Number(i.precio_unitario) || 0,
    unidad:         i.unidad ?? 'NIU',
  }))
}

// ── Estado SUNAT a partir del resultado normalizado ───────────────────────────
function estadoSunat(res: ResultadoSunat): 'borrador' | 'aceptado' | 'aceptado_obs' | 'rechazado' {
  if (!res.ok || !res.aceptado) return 'rechazado'
  const n = res.cdrCodigo != null && /^\d+$/.test(res.cdrCodigo)
    ? parseInt(res.cdrCodigo, 10)
    : 0
  return n >= 4000 ? 'aceptado_obs' : 'aceptado'
}

// ── Clasificación del resultado de un envío: define si se libera el correlativo,
// si se reintenta solo, o si requiere que el dueño lo revise ───────────────────
//
//   aceptado                         → éxito
//   ok=true,  aceptado=false         → SUNAT respondió y RECHAZÓ (dato incorrecto,
//                                       serie inválida, etc.) → definitivo, humano
//   ok=false                         → falla de infraestructura (Lycet/red/timeout,
//                                       SUNAT jamás llegó a evaluar el documento)
//                                       → reintentable, sin intervención humana aún
const MAX_INTENTOS_ENVIO = 8
const PLAZO_LEGAL_DIAS    = 3   // SUNAT exige informar la boleta/factura en máx. 3 días

interface ClasificacionEnvio {
  estado:           'emitido' | 'error'
  estadoSunatFinal: string
  reintentable:     boolean
  requiereAtencion: boolean
}

function clasificarResultado(resultado: ResultadoSunat): ClasificacionEnvio {
  if (resultado.aceptado) {
    return { estado: 'emitido', estadoSunatFinal: estadoSunat(resultado), reintentable: false, requiereAtencion: false }
  }
  if (resultado.ok) {
    return { estado: 'error', estadoSunatFinal: 'rechazado', reintentable: false, requiereAtencion: true }
  }
  return { estado: 'error', estadoSunatFinal: 'error_reintentable', reintentable: true, requiereAtencion: false }
}

function calcularProximoIntento(intentos: number): string {
  const minutos = Math.min(60, 15 * intentos)
  return new Date(Date.now() + minutos * 60_000).toISOString()
}

// Cadena estándar del código QR de la representación impresa (RM 155-2017 SUNAT):
// RUC | TIPO DOC | SERIE | NÚMERO | IGV | TOTAL | FECHA | TIPO DOC CLIENTE | NÚM DOC CLIENTE |
function qrSunat(p: {
  rucEmisor: string; tipoDoc: string; serie: string; correlativo: number
  igv: number; total: number; fecha: string
  clienteTipoDoc: string; clienteNumDoc: string
}): string {
  return [
    p.rucEmisor, p.tipoDoc, p.serie, padCorrelativo(p.correlativo),
    p.igv.toFixed(2), p.total.toFixed(2), p.fecha,
    p.clienteTipoDoc, p.clienteNumDoc,
  ].join('|') + '|'
}

function superoPlazoLegal(fechaEmisionISO: string | null | undefined): boolean {
  if (!fechaEmisionISO) return false
  const emitido = new Date(`${fechaEmisionISO}T00:00:00-05:00`)
  const dias = (Date.now() - emitido.getTime()) / 86_400_000
  return dias >= PLAZO_LEGAL_DIAS
}

// ─────────────────────────────────────────────────────────────────────────────
export class SunatDirectoAdapter implements ProveedorFacturacion {
  nombre = 'sunat_directo' as const

  // ── Boleta ─────────────────────────────────────────────────────────────────
  async emitirBoleta(opts: OpcionesEmisionBoleta): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredencialesSunat(opts.supabase, opts.ferreteriaId)
    if (!creds) return {
      ok: false,
      error: 'SUNAT Directo no configurado o inactivo. Ve a Configuración → Integraciones → SUNAT Directo.',
      tokenInvalido: true,
    }

    let lycetCfg: LycetConfig
    try { lycetCfg = getLycetConfig() }
    catch (e) { return { ok: false, error: (e as Error).message } }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const serie = ferreteria.serie_boletas ?? 'B001'

    const todosLosItems = await mapearItemsDePedido(opts.supabase, opts.pedidoId)
    const itemsFormales   = todosLosItems.filter((i: any) => i.productos?.facturable !== false)
    const itemsInformales = todosLosItems.filter((i: any) => i.productos?.facturable === false)
    if (itemsFormales.length === 0) {
      return { ok: false, error: 'No hay productos facturables en este pedido (todos tienen facturable=false).' }
    }

    const correlativo = await reservarCorrelativo(opts.supabase, opts.ferreteriaId, '03', serie)
    if (!correlativo) return { ok: false, error: 'Error generando número de comprobante' }

    const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
    if (!ensureRes.ok) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '03', serie, correlativo)
      return { ok: false, error: `Error configurando el servicio de facturación: ${ensureRes.error}` }
    }

    const cliente: ClienteLycet = {
      tipoDoc:   opts.clienteDni.replace(/\D/g, '').length === 8 ? '1' : '0',
      numDoc:    opts.clienteDni.replace(/\D/g, '') || '00000000',
      rznSocial: opts.clienteNombre || 'CLIENTES VARIOS',
    }

    const { doc, totales } = mapearInvoice('03', {
      serie, correlativo,
      emisor:      buildEmisor(ferreteria, creds),
      cliente,
      items:       toItemsLycet(itemsFormales),
      igvIncluido: ferreteria.igv_incluido_en_precios ?? false,
    })

    const resultado = await enviarInvoice(lycetCfg, doc)
    const clasif = clasificarResultado(resultado)
    const numeroCompleto = `${serie}-${padCorrelativo(correlativo)}`
    const fechaEmision = fechaEmisionHoy()

    // Solo se libera el correlativo ante un rechazo DEFINITIVO. Una falla de
    // infraestructura mantiene la reserva: el reintento reusa el mismo número.
    if (!resultado.aceptado && !clasif.reintentable) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '03', serie, correlativo)
    }

    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .upsert({
        ferreteria_id:         opts.ferreteriaId,
        pedido_id:             opts.pedidoId,
        tipo:                  'boleta',
        serie,
        numero:                correlativo,
        numero_completo:       numeroCompleto,
        numero_comprobante:    numeroCompleto,
        estado:                clasif.estado,
        estado_sunat:          clasif.estadoSunatFinal,
        fecha_emision:         fechaEmision,
        moneda:                'PEN',
        subtotal:              totales.mtoOperGravadas,
        igv:                   totales.mtoIGV,
        total:                 totales.mtoImpVenta,
        sunat_cdr_codigo:      resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        cdr_notas:             resultado.cdrNotas ?? null,
        hash_cpe:              resultado.hash ?? null,
        qr_cadena:             qrSunat({
          rucEmisor: creds.ruc, tipoDoc: '03', serie, correlativo,
          igv: totales.mtoIGV, total: totales.mtoImpVenta, fecha: fechaEmision,
          clienteTipoDoc: cliente.tipoDoc, clienteNumDoc: cliente.numDoc,
        }),
        cliente_nombre:        opts.clienteNombre,
        cliente_ruc_dni:       opts.clienteDni.replace(/\D/g, '') || null,
        emitido_por:           opts.emitidoPor,
        intentos_envio:        clasif.reintentable ? 1 : 0,
        proximo_intento_at:    clasif.reintentable ? calcularProximoIntento(1) : null,
        ultimo_error_sunat:    !resultado.aceptado ? (resultado.error ?? resultado.cdrDescripcion ?? null) : null,
        requiere_atencion:     clasif.requiereAtencion,
      }, { onConflict: 'pedido_id,tipo' })
      .select('id')
      .single()

    await escribirLog(
      opts.supabase, opts.ferreteriaId, comp?.id ?? null,
      'envio', 'invoice/send', resultado,
      { serie, correlativo, ruc: creds.ruc, tipoDoc: '03' },
    )

    if (clasif.reintentable) {
      // No es un error definitivo: la venta ya tiene comprobante en cola, se
      // reintentará solo. Se informa como éxito parcial para no bloquear al cajero.
      return { ok: true, comprobanteId: comp?.id, numeroCompleto, error: 'Comprobante en cola de reintento (SUNAT/servicio no disponible momentáneamente)' }
    }
    if (!resultado.ok)       return { ok: false, error: resultado.error ?? 'Error enviando a SUNAT' }
    if (!resultado.aceptado) return { ok: false, error: resultado.cdrDescripcion ?? `SUNAT rechazó la boleta (código ${resultado.cdrCodigo})` }

    const comprobanteSecundarioId = itemsInformales.length > 0
      ? await crearNotaVentaInterna({
          supabase:      opts.supabase,
          ferreteriaId:  opts.ferreteriaId,
          pedidoId:      opts.pedidoId,
          todosLosItems,
          clienteNombre: opts.clienteNombre,
          clienteDoc:    opts.clienteDni.replace(/\D/g, ''),
          emitidoPor:    opts.emitidoPor,
        })
      : undefined

    return { ok: true, comprobanteId: comp?.id, numeroCompleto, comprobanteSecundarioId }
  }

  // ── Factura ────────────────────────────────────────────────────────────────
  async emitirFactura(opts: OpcionesEmisionFactura): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredencialesSunat(opts.supabase, opts.ferreteriaId)
    if (!creds) return {
      ok: false,
      error: 'SUNAT Directo no configurado. Ve a Configuración → Integraciones → SUNAT Directo.',
      tokenInvalido: true,
    }

    let lycetCfg: LycetConfig
    try { lycetCfg = getLycetConfig() }
    catch (e) { return { ok: false, error: (e as Error).message } }

    const clienteRucLimpio = opts.clienteRuc.replace(/\D/g, '')
    if (clienteRucLimpio.length !== 11) {
      return { ok: false, error: `RUC inválido: debe tener 11 dígitos (recibido: "${clienteRucLimpio}")` }
    }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const serie = ferreteria.serie_facturas ?? 'F001'

    const todosLosItems = await mapearItemsDePedido(opts.supabase, opts.pedidoId)
    const itemsFormales   = todosLosItems.filter((i: any) => i.productos?.facturable !== false)
    const itemsInformales = todosLosItems.filter((i: any) => i.productos?.facturable === false)
    if (itemsFormales.length === 0) {
      return { ok: false, error: 'No hay productos facturables en este pedido' }
    }

    const correlativo = await reservarCorrelativo(opts.supabase, opts.ferreteriaId, '01', serie)
    if (!correlativo) return { ok: false, error: 'Error generando número de comprobante' }

    const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
    if (!ensureRes.ok) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '01', serie, correlativo)
      return { ok: false, error: `Error configurando el servicio de facturación: ${ensureRes.error}` }
    }

    const cliente: ClienteLycet = {
      tipoDoc: '6', numDoc: clienteRucLimpio, rznSocial: opts.clienteNombre,
    }

    const { doc, totales } = mapearInvoice('01', {
      serie, correlativo,
      emisor:      buildEmisor(ferreteria, creds),
      cliente,
      items:       toItemsLycet(itemsFormales),
      igvIncluido: ferreteria.igv_incluido_en_precios ?? false,
    })

    const resultado = await enviarInvoice(lycetCfg, doc)
    const clasif = clasificarResultado(resultado)
    const numeroCompleto = `${serie}-${padCorrelativo(correlativo)}`
    const fechaEmision = fechaEmisionHoy()

    if (!resultado.aceptado && !clasif.reintentable) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '01', serie, correlativo)
    }

    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .upsert({
        ferreteria_id:         opts.ferreteriaId,
        pedido_id:             opts.pedidoId,
        tipo:                  'factura',
        serie,
        numero:                correlativo,
        numero_completo:       numeroCompleto,
        numero_comprobante:    numeroCompleto,
        estado:                clasif.estado,
        estado_sunat:          clasif.estadoSunatFinal,
        fecha_emision:         fechaEmision,
        moneda:                'PEN',
        subtotal:              totales.mtoOperGravadas,
        igv:                   totales.mtoIGV,
        total:                 totales.mtoImpVenta,
        sunat_cdr_codigo:      resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        cdr_notas:             resultado.cdrNotas ?? null,
        hash_cpe:              resultado.hash ?? null,
        qr_cadena:             qrSunat({
          rucEmisor: creds.ruc, tipoDoc: '01', serie, correlativo,
          igv: totales.mtoIGV, total: totales.mtoImpVenta, fecha: fechaEmision,
          clienteTipoDoc: '6', clienteNumDoc: clienteRucLimpio,
        }),
        cliente_nombre:        opts.clienteNombre,
        cliente_ruc_dni:       clienteRucLimpio,
        emitido_por:           opts.emitidoPor,
        intentos_envio:        clasif.reintentable ? 1 : 0,
        proximo_intento_at:    clasif.reintentable ? calcularProximoIntento(1) : null,
        ultimo_error_sunat:    !resultado.aceptado ? (resultado.error ?? resultado.cdrDescripcion ?? null) : null,
        requiere_atencion:     clasif.requiereAtencion,
      }, { onConflict: 'pedido_id,tipo' })
      .select('id')
      .single()

    await escribirLog(
      opts.supabase, opts.ferreteriaId, comp?.id ?? null,
      'envio', 'invoice/send', resultado,
      { serie, correlativo, ruc: creds.ruc, tipoDoc: '01' },
    )

    if (clasif.reintentable) {
      return { ok: true, comprobanteId: comp?.id, numeroCompleto, error: 'Comprobante en cola de reintento (SUNAT/servicio no disponible momentáneamente)' }
    }
    if (!resultado.ok)       return { ok: false, error: resultado.error ?? 'Error enviando a SUNAT' }
    if (!resultado.aceptado) return { ok: false, error: resultado.cdrDescripcion ?? `SUNAT rechazó la factura (código ${resultado.cdrCodigo})` }

    const comprobanteSecundarioId = itemsInformales.length > 0
      ? await crearNotaVentaInterna({
          supabase:      opts.supabase,
          ferreteriaId:  opts.ferreteriaId,
          pedidoId:      opts.pedidoId,
          todosLosItems,
          clienteNombre: opts.clienteNombre,
          clienteDoc:    clienteRucLimpio,
          emitidoPor:    opts.emitidoPor,
        })
      : undefined

    return { ok: true, comprobanteId: comp?.id, numeroCompleto, comprobanteSecundarioId }
  }

  // ── Reintento de envío (job automático — solo comprobantes en `error_reintentable`) ──
  // Reutiliza la MISMA serie/correlativo del intento original (nunca reserva uno nuevo):
  // los ítems del pedido no cambian, así que reconstruir el documento es determinístico.
  async reintentarEnvio(opts: OpcionesReintentoEnvio): Promise<ResultadoEmisionUnificado> {
    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .select('*')
      .eq('id', opts.comprobanteId)
      .eq('ferreteria_id', opts.ferreteriaId)
      .single()

    if (!comp) return { ok: false, error: 'Comprobante no encontrado' }
    if (!comp.pedido_id) return { ok: false, error: 'Comprobante sin pedido asociado — no se puede reintentar' }
    if (comp.tipo !== 'boleta' && comp.tipo !== 'factura') {
      return { ok: false, error: `Reintento no soportado para tipo "${comp.tipo}"` }
    }

    const creds = await cargarCredencialesSunat(opts.supabase, opts.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado o inactivo.' }

    let lycetCfg: LycetConfig
    try { lycetCfg = getLycetConfig() }
    catch (e) { return { ok: false, error: (e as Error).message } }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const todosLosItems = await mapearItemsDePedido(opts.supabase, comp.pedido_id)
    const itemsFormales  = todosLosItems.filter((i: any) => i.productos?.facturable !== false)
    if (itemsFormales.length === 0) {
      return { ok: false, error: 'El pedido ya no tiene productos facturables' }
    }

    const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
    if (!ensureRes.ok) {
      return { ok: false, error: `Error configurando el servicio de facturación: ${ensureRes.error}` }
    }

    const tipoDoc = comp.tipo === 'factura' ? '01' : '03'
    const cliente: ClienteLycet = comp.tipo === 'factura'
      ? { tipoDoc: '6', numDoc: comp.cliente_ruc_dni || '00000000', rznSocial: comp.cliente_nombre || 'CLIENTES VARIOS' }
      : {
          tipoDoc:   (comp.cliente_ruc_dni ?? '').replace(/\D/g, '').length === 8 ? '1' : '0',
          numDoc:    comp.cliente_ruc_dni || '00000000',
          rznSocial: comp.cliente_nombre || 'CLIENTES VARIOS',
        }

    const { doc, totales } = mapearInvoice(tipoDoc, {
      serie:       comp.serie,
      correlativo: comp.numero,
      emisor:      buildEmisor(ferreteria, creds),
      cliente,
      items:       toItemsLycet(itemsFormales),
      igvIncluido: ferreteria.igv_incluido_en_precios ?? false,
    })

    const resultado = await enviarInvoice(lycetCfg, doc)
    const numeroCompleto = `${comp.serie}-${padCorrelativo(comp.numero)}`

    await escribirLog(
      opts.supabase, opts.ferreteriaId, comp.id,
      'envio', 'invoice/send (reintento)', resultado,
      { serie: comp.serie, correlativo: comp.numero, ruc: creds.ruc, tipoDoc },
    )

    if (resultado.aceptado) {
      await opts.supabase.from('comprobantes').update({
        estado:                'emitido',
        estado_sunat:          estadoSunat(resultado),
        sunat_cdr_codigo:      resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        cdr_notas:             resultado.cdrNotas ?? null,
        subtotal:              totales.mtoOperGravadas,
        igv:                   totales.mtoIGV,
        total:                 totales.mtoImpVenta,
        intentos_envio:        0,
        proximo_intento_at:    null,
        ultimo_error_sunat:    null,
        requiere_atencion:     false,
      }).eq('id', comp.id)
      return { ok: true, comprobanteId: comp.id, numeroCompleto }
    }

    if (resultado.ok) {
      // SUNAT respondió y rechazó — ya no es un problema de infraestructura.
      // Libera el correlativo y pasa a requerir revisión humana.
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, tipoDoc, comp.serie, comp.numero)
      await opts.supabase.from('comprobantes').update({
        estado:                'error',
        estado_sunat:          'rechazado',
        sunat_cdr_codigo:      resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        ultimo_error_sunat:    resultado.cdrDescripcion ?? resultado.error ?? null,
        proximo_intento_at:    null,
        requiere_atencion:     true,
      }).eq('id', comp.id)
      return { ok: false, error: resultado.cdrDescripcion ?? `SUNAT rechazó el comprobante (código ${resultado.cdrCodigo})` }
    }

    // Sigue siendo infraestructura — reprogramar, o escalar a atención humana
    // si se agotaron los intentos o el plazo legal de 3 días está por vencer.
    const intentos = (comp.intentos_envio ?? 0) + 1
    const agotado  = intentos >= MAX_INTENTOS_ENVIO || superoPlazoLegal(comp.fecha_emision)

    await opts.supabase.from('comprobantes').update({
      intentos_envio:     intentos,
      proximo_intento_at: agotado ? null : calcularProximoIntento(intentos),
      ultimo_error_sunat: resultado.error,
      requiere_atencion:  agotado,
    }).eq('id', comp.id)

    return { ok: false, error: resultado.error ?? 'Error de infraestructura al reintentar' }
  }

  // ── Solicitar anulación (Fase 2) ───────────────────────────────────────────
  // No llama a SUNAT — solo marca la intención. El envío real (RC de baja para
  // boletas, Comunicación de Baja para facturas) lo procesa el job nocturno,
  // que agrupa por día y respeta la regla de SUNAT de esperar al día siguiente.
  async solicitarAnulacion(opts: OpcionesSolicitarAnulacion): Promise<ResultadoAnulacion> {
    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .select('id, tipo, estado_sunat, anulacion_solicitada')
      .eq('id', opts.comprobanteId)
      .eq('ferreteria_id', opts.ferreteriaId)
      .single()

    if (!comp) return { ok: false, error: 'Comprobante no encontrado' }
    if (comp.tipo !== 'boleta' && comp.tipo !== 'factura') {
      return { ok: false, error: 'Este tipo de documento no se anula por esta vía (usa Nota de Crédito)' }
    }
    if (!['aceptado', 'aceptado_obs'].includes(comp.estado_sunat ?? '')) {
      return { ok: false, error: 'Solo se pueden anular comprobantes aceptados por SUNAT' }
    }
    if (comp.anulacion_solicitada) {
      return { ok: false, error: 'Ya hay una anulación en trámite para este comprobante' }
    }

    await opts.supabase.from('comprobantes').update({
      anulacion_solicitada:    true,
      anulacion_motivo:        opts.motivo,
      anulacion_solicitada_at: new Date().toISOString(),
      anulacion_solicitada_por: opts.usuario,
    }).eq('id', opts.comprobanteId)

    return { ok: true }
  }

  // ── Nota de Crédito ────────────────────────────────────────────────────────
  async emitirNotaCredito(opts: OpcionesNotaCredito): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredencialesSunat(opts.supabase, opts.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado.', tokenInvalido: true }

    let lycetCfg: LycetConfig
    try { lycetCfg = getLycetConfig() }
    catch (e) { return { ok: false, error: (e as Error).message } }

    const { data: ref } = await opts.supabase
      .from('comprobantes')
      .select('*, pedidos(id, items_pedido(*))')
      .eq('id', opts.comprobanteReferenciaId)
      .eq('ferreteria_id', opts.ferreteriaId)
      .single()

    if (!ref || ref.estado !== 'emitido') {
      return { ok: false, error: 'Comprobante original no encontrado o no emitido' }
    }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    const isBoleta       = ref.tipo === 'boleta'
    const tipoDocAfectado = isBoleta ? '03' : '01'
    const serie           = isBoleta ? 'BC01' : 'FC01'

    const correlativo = await reservarCorrelativo(opts.supabase, opts.ferreteriaId, '07', serie)
    if (!correlativo) return { ok: false, error: 'Error generando correlativo NC' }

    const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
    if (!ensureRes.ok) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '07', serie, correlativo)
      return { ok: false, error: `Error configurando el servicio de facturación: ${ensureRes.error}` }
    }

    let originalItems = (ref.pedidos?.items_pedido ?? []) as any[]
    if (opts.itemsDevueltos?.length) {
      originalItems = originalItems
        .map((oi: any) => {
          const dev = opts.itemsDevueltos!.find(d => d.producto_id === oi.producto_id)
          return dev ? { ...oi, cantidad: dev.cantidad } : null
        })
        .filter(Boolean)
    }

    const cliente: ClienteLycet = {
      tipoDoc:   isBoleta ? '1' : '6',
      numDoc:    ref.cliente_ruc_dni || '00000000',
      rznSocial: ref.cliente_nombre  || 'CLIENTES VARIOS',
    }

    const numDocAfectado = `${ref.serie}-${padCorrelativo(ref.numero)}`

    const { doc, totales } = mapearNota({
      serie, correlativo,
      emisor:          buildEmisor(ferreteria, creds),
      cliente,
      items:           toItemsLycet(originalItems),
      igvIncluido:     ferreteria?.igv_incluido_en_precios ?? false,
      tipoDocAfectado,
      numDocAfectado,
      codMotivo:       opts.motivoCodigo,
      desMotivo:       opts.motivoDescripcion,
    })

    const resultado = await enviarNota(lycetCfg, doc)
    const estadoFinal = estadoSunat(resultado)
    const numeroCompleto = `${serie}-${padCorrelativo(correlativo)}`
    const fechaEmision = fechaEmisionHoy()

    if (!resultado.aceptado) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '07', serie, correlativo)
    }

    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .insert({
        ferreteria_id:             opts.ferreteriaId,
        pedido_id:                 ref.pedido_id,
        tipo:                      'nota_credito',
        serie,
        numero:                    correlativo,
        numero_completo:           numeroCompleto,
        numero_comprobante:        numeroCompleto,
        estado:                    resultado.aceptado ? 'emitido' : 'error',
        estado_sunat:              estadoFinal,
        fecha_emision:             fechaEmision,
        moneda:                    'PEN',
        subtotal:                  totales.mtoOperGravadas,
        igv:                       totales.mtoIGV,
        total:                     totales.mtoImpVenta,
        sunat_cdr_codigo:          resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion:     resultado.cdrDescripcion ?? null,
        cdr_notas:                 resultado.cdrNotas ?? null,
        hash_cpe:                  resultado.hash ?? null,
        qr_cadena:                 qrSunat({
          rucEmisor: creds.ruc, tipoDoc: '07', serie, correlativo,
          igv: totales.mtoIGV, total: totales.mtoImpVenta, fecha: fechaEmision,
          clienteTipoDoc: cliente.tipoDoc, clienteNumDoc: cliente.numDoc,
        }),
        cliente_nombre:            ref.cliente_nombre,
        cliente_ruc_dni:           ref.cliente_ruc_dni,
        emitido_por:               opts.emitidoPor,
        comprobante_referencia_id: ref.id,
      })
      .select('id')
      .single()

    await escribirLog(
      opts.supabase, opts.ferreteriaId, comp?.id ?? null,
      'envio', 'note/send', resultado,
      { serie, correlativo, ruc: creds.ruc, tipoDoc: '07' },
    )

    if (!resultado.ok)       return { ok: false, error: resultado.error ?? 'Error enviando NC a SUNAT' }
    if (!resultado.aceptado) return { ok: false, error: resultado.cdrDescripcion ?? `SUNAT rechazó la NC (código ${resultado.cdrCodigo})` }

    // Devolver el stock de los items anulados/devueltos (mismo comportamiento
    // que tenía la ruta de NC antes de unificar proveedores).
    for (const item of originalItems) {
      if (item.producto_id) {
        const { error: rpcErr } = await opts.supabase.rpc('restaurar_stock_parcial', {
          p_producto_id: item.producto_id,
          p_cantidad:    item.cantidad,
        })
        if (rpcErr) console.error('[NotaCredito] Error ajustando stock:', rpcErr)
      }
    }

    return { ok: true, comprobanteId: comp?.id, numeroCompleto }
  }

  // ── Boleta de prueba (homologación SUNAT) ──────────────────────────────────
  async emitirBoletaPrueba(opts: {
    supabase:     any
    ferreteriaId: string
    indice:       number
  }): Promise<ResultadoEmisionUnificado & { cdrCodigo?: string }> {
    const creds = await cargarCredencialesSunat(opts.supabase, opts.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado o inactivo.', tokenInvalido: true }

    let lycetCfg: LycetConfig
    try { lycetCfg = getLycetConfig() }
    catch (e) { return { ok: false, error: (e as Error).message } }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const serie = ferreteria.serie_boletas ?? 'B001'

    const correlativo = await reservarCorrelativo(opts.supabase, opts.ferreteriaId, '03', serie)
    if (!correlativo) return { ok: false, error: 'Error generando correlativo' }

    const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
    if (!ensureRes.ok) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '03', serie, correlativo)
      return { ok: false, error: `Error configurando el servicio de facturación: ${ensureRes.error}` }
    }

    const { doc, totales } = mapearInvoice('03', {
      serie, correlativo,
      emisor:  buildEmisor(ferreteria, creds),
      cliente: { tipoDoc: '0', numDoc: '00000000', rznSocial: 'CLIENTES VARIOS' },
      items:   [{ descripcion: `MATERIAL DE CONSTRUCCION TEST HOMOLOGACION ${opts.indice}`, cantidad: 1, precioUnitario: 10.00, unidad: 'NIU' }],
      igvIncluido: false,
    })

    const resultado     = await enviarInvoice(lycetCfg, doc)
    const estadoFinal   = estadoSunat(resultado)
    const numeroCompleto = `${serie}-${padCorrelativo(correlativo)}`

    if (!resultado.aceptado) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, '03', serie, correlativo)
    }

    await opts.supabase.from('comprobantes').insert({
      ferreteria_id:      opts.ferreteriaId,
      pedido_id:          null,
      tipo:               'boleta',
      serie,
      numero:             correlativo,
      numero_completo:    numeroCompleto,
      numero_comprobante: numeroCompleto,
      estado:             resultado.aceptado ? 'emitido' : 'error',
      estado_sunat:       estadoFinal,
      fecha_emision:      fechaEmisionHoy(),
      moneda:             'PEN',
      subtotal:           totales.mtoOperGravadas,
      igv:                totales.mtoIGV,
      total:              totales.mtoImpVenta,
      sunat_cdr_codigo:      resultado.cdrCodigo ?? null,
      sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
      cliente_nombre:     'CLIENTES VARIOS',
      emitido_por:        'homologacion_sunat',
    })

    if (!resultado.ok || !resultado.aceptado) {
      return {
        ok: false,
        error: resultado.cdrDescripcion ?? resultado.error ?? 'SUNAT rechazó la boleta de prueba',
        cdrCodigo: resultado.cdrCodigo ?? undefined,
      }
    }

    return { ok: true, numeroCompleto, cdrCodigo: resultado.cdrCodigo ?? undefined }
  }
}
