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
  OpcionesNotaDebito,
  OpcionesReintentoEnvio,
  OpcionesSolicitarAnulacion,
  ResultadoAnulacion,
  ResultadoEmisionUnificado,
} from './types'
import { buscarMotivo, CATALOGO_09_NOTA_CREDITO, CATALOGO_10_NOTA_DEBITO } from './catalogos-sunat'
import { resolverSerie } from '@/lib/sucursales/series'

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

// Cliente de una NC/ND derivado del comprobante original. Para boletas sin
// documento (CLIENTES VARIOS) el tipoDoc debe ser '0' — SUNAT rechaza DNI
// "00000000" como tipoDoc '1'.
function clienteDeReferencia(ref: any): ClienteLycet {
  if (ref.tipo === 'factura') {
    return { tipoDoc: '6', numDoc: ref.cliente_ruc_dni || '00000000', rznSocial: ref.cliente_nombre || 'CLIENTES VARIOS' }
  }
  const doc = (ref.cliente_ruc_dni ?? '').replace(/\D/g, '')
  return {
    tipoDoc:   doc.length === 8 && doc !== '00000000' ? '1' : '0',
    numDoc:    doc || '00000000',
    rznSocial: ref.cliente_nombre || 'CLIENTES VARIOS',
  }
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

    // Serie por sucursal (fallback: serie del tenant — comportamiento clásico)
    const serieRes = await resolverSerie(opts.supabase, opts.ferreteriaId, 'boleta', opts.localId ?? null)
    const serie = serieRes.serie

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
      emisor:      { ...buildEmisor(ferreteria, creds), codLocal: serieRes.codigoSunat },
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
        local_id:              serieRes.localId,
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

    // Serie por sucursal (fallback: serie del tenant — comportamiento clásico)
    const serieRes = await resolverSerie(opts.supabase, opts.ferreteriaId, 'factura', opts.localId ?? null)
    const serie = serieRes.serie

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
      emisor:      { ...buildEmisor(ferreteria, creds), codLocal: serieRes.codigoSunat },
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
        local_id:              serieRes.localId,
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

    if (comp.tipo === 'nota_credito' || comp.tipo === 'nota_debito') {
      return this.reintentarNota(opts, comp)
    }

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

    // Mismo codLocal del intento original (si el comprobante nació en una sucursal)
    let codLocal = '0000'
    if (comp.local_id) {
      const { data: loc } = await opts.supabase
        .from('locales_ferreteria')
        .select('codigo_sunat')
        .eq('id', comp.local_id)
        .single()
      codLocal = loc?.codigo_sunat ?? '0000'
    }

    const { doc, totales } = mapearInvoice(tipoDoc, {
      serie:       comp.serie,
      correlativo: comp.numero,
      emisor:      { ...buildEmisor(ferreteria, creds), codLocal },
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

  // ── Reintento de NC/ND — reconstruye desde el snapshot `detalle_emision`,
  // sin volver a derivar ítems del pedido (que pudo cambiar entretanto).
  private async reintentarNota(opts: OpcionesReintentoEnvio, comp: any): Promise<ResultadoEmisionUnificado> {
    const snap = comp.detalle_emision
    if (!snap) {
      return { ok: false, error: 'No hay snapshot de emisión guardado — no se puede reintentar automáticamente. Emite una nueva.' }
    }

    const creds = await cargarCredencialesSunat(opts.supabase, opts.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado o inactivo.' }

    let lycetCfg: LycetConfig
    try { lycetCfg = getLycetConfig() }
    catch (e) { return { ok: false, error: (e as Error).message } }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
    if (!ensureRes.ok) {
      return { ok: false, error: `Error configurando el servicio de facturación: ${ensureRes.error}` }
    }

    const { doc, totales } = mapearNota({
      serie: comp.serie, correlativo: comp.numero,
      emisor: buildEmisor(ferreteria, creds),
      cliente: snap.cliente,
      items: snap.itemsLycet,
      igvIncluido: ferreteria.igv_incluido_en_precios ?? false,
      tipoNota: snap.tipoNota,
      tipoDocAfectado: snap.tipoDocAfectado,
      numDocAfectado: snap.numDocAfectado,
      codMotivo: snap.codMotivo, desMotivo: snap.desMotivo,
    })

    const resultado = await enviarNota(lycetCfg, doc)
    const numeroCompleto = `${comp.serie}-${padCorrelativo(comp.numero)}`

    await escribirLog(
      opts.supabase, opts.ferreteriaId, comp.id,
      'envio', 'note/send (reintento)', resultado,
      { serie: comp.serie, correlativo: comp.numero, ruc: creds.ruc, tipoDoc: snap.tipoNota },
    )

    if (resultado.aceptado) {
      await opts.supabase.from('comprobantes').update({
        estado: 'emitido', estado_sunat: estadoSunat(resultado),
        sunat_cdr_codigo: resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        cdr_notas: resultado.cdrNotas ?? null,
        hash_cpe: resultado.hash ?? null,
        subtotal: totales.mtoOperGravadas, igv: totales.mtoIGV, total: totales.mtoImpVenta,
        intentos_envio: 0, proximo_intento_at: null, ultimo_error_sunat: null, requiere_atencion: false,
      }).eq('id', comp.id)
      return { ok: true, comprobanteId: comp.id, numeroCompleto }
    }

    if (resultado.ok) {
      await rollbackCorrelativo(opts.supabase, opts.ferreteriaId, snap.tipoNota, comp.serie, comp.numero)
      await opts.supabase.from('comprobantes').update({
        estado: 'error', estado_sunat: 'rechazado',
        sunat_cdr_codigo: resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        ultimo_error_sunat: resultado.cdrDescripcion ?? resultado.error ?? null,
        proximo_intento_at: null, requiere_atencion: true,
      }).eq('id', comp.id)
      return { ok: false, error: resultado.cdrDescripcion ?? `SUNAT rechazó la nota (código ${resultado.cdrCodigo})` }
    }

    const intentos = (comp.intentos_envio ?? 0) + 1
    const agotado  = intentos >= MAX_INTENTOS_ENVIO || superoPlazoLegal(comp.fecha_emision)
    await opts.supabase.from('comprobantes').update({
      intentos_envio: intentos,
      proximo_intento_at: agotado ? null : calcularProximoIntento(intentos),
      ultimo_error_sunat: resultado.error, requiere_atencion: agotado,
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
    const motivo = buscarMotivo(CATALOGO_09_NOTA_CREDITO, opts.motivoCodigo)
    if (!motivo) return { ok: false, error: `Motivo de NC desconocido: "${opts.motivoCodigo}"` }

    const { data: ref } = await opts.supabase
      .from('comprobantes')
      .select('*, pedidos(id, items_pedido(*))')
      .eq('id', opts.comprobanteReferenciaId)
      .eq('ferreteria_id', opts.ferreteriaId)
      .single()

    if (!ref || ref.estado !== 'emitido') {
      return { ok: false, error: 'Comprobante original no encontrado o no emitido' }
    }
    if (ref.tipo !== 'boleta' && ref.tipo !== 'factura') {
      return { ok: false, error: 'Una Nota de Crédito solo puede referenciar una boleta o factura' }
    }

    // ── Guard anti-doble-NC ───────────────────────────────────────────────────
    // Suma las NC ya emitidas contra este comprobante; si junto con la nueva
    // se pasan del total original, se bloquea (evita devolver/anular de más).
    // Cuentan también las NC en cola de reintento: tienen correlativo reservado
    // y pueden ser aceptadas por SUNAT después.
    const { data: ncPrevias } = await opts.supabase
      .from('comprobantes')
      .select('total, estado, estado_sunat')
      .eq('comprobante_referencia_id', ref.id)
      .eq('tipo', 'nota_credito')
    const sumaPrevia = (ncPrevias ?? [])
      .filter((c: any) => c.estado === 'emitido' || c.estado_sunat === 'error_reintentable')
      .reduce((s: number, c: any) => s + (Number(c.total) || 0), 0)

    const todosLosItems = (ref.pedidos?.items_pedido ?? []) as any[]

    // ── Construir ítems según el comportamiento del motivo (catálogo 09) ─────
    let itemsParaNota: any[]
    if (motivo.comportamiento === 'items') {
      if (!opts.itemsDevueltos?.length) {
        return { ok: false, error: 'Selecciona al menos un ítem a devolver' }
      }
      for (const dev of opts.itemsDevueltos) {
        const oi = todosLosItems.find((i: any) => i.id === dev.itemId)
        if (oi && (dev.cantidad <= 0 || dev.cantidad > Number(oi.cantidad))) {
          return { ok: false, error: `Cantidad inválida para "${oi.nombre_producto}": máximo ${oi.cantidad}` }
        }
      }
      itemsParaNota = todosLosItems
        .map((oi: any) => {
          const dev = opts.itemsDevueltos!.find(d => d.itemId === oi.id)
          return dev ? { ...oi, cantidad: dev.cantidad } : null
        })
        .filter(Boolean)
      if (itemsParaNota.length === 0) {
        return { ok: false, error: 'Ningún ítem seleccionado coincide con el pedido original' }
      }
    } else if (motivo.comportamiento === 'monto_directo') {
      if (!opts.montoAjuste || opts.montoAjuste <= 0) {
        return { ok: false, error: 'Ingresa el monto del ajuste' }
      }
      itemsParaNota = [{
        nombre_producto: opts.motivoDescripcion || motivo.descripcion,
        cantidad:        1,
        precio_unitario: opts.montoAjuste,
        unidad:          'NIU',
        producto_id:     null,
      }]
    } else {
      // documento_completo: todo el comprobante (anulación total)
      itemsParaNota = todosLosItems
    }

    const itemsLycet = toItemsLycet(itemsParaNota)

    const isBoleta        = ref.tipo === 'boleta'
    const tipoDocAfectado = isBoleta ? '03' : '01'
    const numDocAfectado  = `${ref.serie}-${padCorrelativo(ref.numero)}`
    const cliente = clienteDeReferencia(ref)

    const resultado = await this.construirYEnviarNota({
      supabase: opts.supabase, ferreteriaId: opts.ferreteriaId,
      tipoNota: '07', serieBase: isBoleta ? 'BC01' : 'FC01',
      tipoDocAfectado, numDocAfectado, cliente, itemsLycet,
      codMotivo: opts.motivoCodigo, desMotivo: opts.motivoDescripcion,
      pedidoId: ref.pedido_id, referenciaId: ref.id, emitidoPor: opts.emitidoPor,
      localId: ref.local_id ?? null, // la NC hereda la sucursal del original
      // Siempre acotado: una NC (o la suma de varias) jamás puede superar el
      // total del comprobante original.
      totalMaximo: Number(ref.total) - sumaPrevia,
    })

    if (!resultado.ok) return resultado

    // Devolver el stock de los items devueltos (solo motivos 'items').
    if (motivo.comportamiento === 'items') {
      for (const item of itemsParaNota) {
        if (item.producto_id) {
          const { error: rpcErr } = await opts.supabase.rpc('restaurar_stock_parcial', {
            p_producto_id: item.producto_id,
            p_cantidad:    item.cantidad,
          })
          if (rpcErr) console.error('[NotaCredito] Error ajustando stock:', rpcErr)
        }
      }
    }

    return resultado
  }

  // ── Nota de Débito ─────────────────────────────────────────────────────────
  // Siempre es un cargo adicional directo (intereses, aumento de valor,
  // penalidad) — no toca ítems del pedido original ni el stock.
  async emitirNotaDebito(opts: OpcionesNotaDebito): Promise<ResultadoEmisionUnificado> {
    if (!buscarMotivo(CATALOGO_10_NOTA_DEBITO, opts.motivoCodigo)) {
      return { ok: false, error: `Motivo de ND desconocido: "${opts.motivoCodigo}"` }
    }
    if (!opts.montoAjuste || opts.montoAjuste <= 0) {
      return { ok: false, error: 'Ingresa el monto del cargo' }
    }

    const { data: ref } = await opts.supabase
      .from('comprobantes')
      .select('*')
      .eq('id', opts.comprobanteReferenciaId)
      .eq('ferreteria_id', opts.ferreteriaId)
      .single()

    if (!ref || ref.estado !== 'emitido') {
      return { ok: false, error: 'Comprobante original no encontrado o no emitido' }
    }
    if (ref.tipo !== 'boleta' && ref.tipo !== 'factura') {
      return { ok: false, error: 'Una Nota de Débito solo puede referenciar una boleta o factura' }
    }

    const isBoleta = ref.tipo === 'boleta'
    const itemsLycet = toItemsLycet([{
      nombre_producto: opts.motivoDescripcion,
      cantidad:        1,
      precio_unitario: opts.montoAjuste,
      unidad:          'NIU',
    }])

    return this.construirYEnviarNota({
      supabase: opts.supabase, ferreteriaId: opts.ferreteriaId,
      tipoNota: '08', serieBase: isBoleta ? 'BD01' : 'FD01',
      tipoDocAfectado: isBoleta ? '03' : '01',
      numDocAfectado:  `${ref.serie}-${padCorrelativo(ref.numero)}`,
      cliente: clienteDeReferencia(ref),
      itemsLycet,
      codMotivo: opts.motivoCodigo, desMotivo: opts.motivoDescripcion,
      pedidoId: ref.pedido_id, referenciaId: ref.id, emitidoPor: opts.emitidoPor,
      localId: ref.local_id ?? null, // la ND hereda la sucursal del original
    })
  }

  // ── Helper compartido NC/ND: reserva correlativo, envía a Lycet y persiste ──
  // el comprobante + un snapshot (`detalle_emision`) que permite reintentar sin
  // volver a derivar los ítems del pedido (que pudo cambiar entretanto).
  private async construirYEnviarNota(p: {
    supabase: any; ferreteriaId: string
    tipoNota: '07' | '08'; serieBase: string
    tipoDocAfectado: string; numDocAfectado: string
    cliente: ClienteLycet; itemsLycet: ItemLycet[]
    codMotivo: string; desMotivo: string
    pedidoId: string | null; referenciaId: string
    emitidoPor: 'dashboard' | 'bot'
    localId?: string | null   // sucursal heredada del comprobante original
    totalMaximo?: number   // si se pasa, valida antes de enviar (guard anti-doble-NC)
  }): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredencialesSunat(p.supabase, p.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado.', tokenInvalido: true }

    let lycetCfg: LycetConfig
    try { lycetCfg = getLycetConfig() }
    catch (e) { return { ok: false, error: (e as Error).message } }

    const ferreteria = await obtenerFerreteria(p.supabase, p.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const tipoDocLabel = p.tipoNota === '07' ? 'nota_credito' : 'nota_debito'
    const correlativo = await reservarCorrelativo(p.supabase, p.ferreteriaId, p.tipoNota, p.serieBase)
    if (!correlativo) return { ok: false, error: `Error generando correlativo de ${p.tipoNota === '07' ? 'NC' : 'ND'}` }

    const ensureRes = await registrarEmpresaEnLycet(lycetCfg, creds)
    if (!ensureRes.ok) {
      await rollbackCorrelativo(p.supabase, p.ferreteriaId, p.tipoNota, p.serieBase, correlativo)
      return { ok: false, error: `Error configurando el servicio de facturación: ${ensureRes.error}` }
    }

    const { doc, totales } = mapearNota({
      serie: p.serieBase, correlativo,
      emisor: buildEmisor(ferreteria, creds),
      cliente: p.cliente,
      items: p.itemsLycet,
      igvIncluido: ferreteria.igv_incluido_en_precios ?? false,
      tipoNota: p.tipoNota,
      tipoDocAfectado: p.tipoDocAfectado,
      numDocAfectado: p.numDocAfectado,
      codMotivo: p.codMotivo, desMotivo: p.desMotivo,
    })

    if (p.totalMaximo !== undefined && totales.mtoImpVenta > p.totalMaximo + 0.01) {
      await rollbackCorrelativo(p.supabase, p.ferreteriaId, p.tipoNota, p.serieBase, correlativo)
      return {
        ok: false,
        error: `El monto de la nota (${totales.mtoImpVenta.toFixed(2)}) supera lo disponible para devolver/ajustar (${p.totalMaximo.toFixed(2)}). Ya existen notas de crédito previas sobre este comprobante.`,
      }
    }

    const resultado = await enviarNota(lycetCfg, doc)
    const clasif = clasificarResultado(resultado)
    const numeroCompleto = `${p.serieBase}-${padCorrelativo(correlativo)}`
    const fechaEmision = fechaEmisionHoy()

    // Solo se libera el correlativo ante un rechazo DEFINITIVO — una falla de
    // infraestructura mantiene la reserva para que el reintento la reuse.
    if (!resultado.aceptado && !clasif.reintentable) {
      await rollbackCorrelativo(p.supabase, p.ferreteriaId, p.tipoNota, p.serieBase, correlativo)
    }

    const { data: comp } = await p.supabase
      .from('comprobantes')
      .insert({
        ferreteria_id:             p.ferreteriaId,
        pedido_id:                 p.pedidoId,
        tipo:                      tipoDocLabel,
        local_id:                  p.localId ?? null,
        serie:                     p.serieBase,
        numero:                    correlativo,
        numero_completo:           numeroCompleto,
        numero_comprobante:        numeroCompleto,
        estado:                    clasif.estado,
        estado_sunat:              clasif.estadoSunatFinal,
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
          rucEmisor: creds.ruc, tipoDoc: p.tipoNota, serie: p.serieBase, correlativo,
          igv: totales.mtoIGV, total: totales.mtoImpVenta, fecha: fechaEmision,
          clienteTipoDoc: p.cliente.tipoDoc, clienteNumDoc: p.cliente.numDoc,
        }),
        cliente_nombre:            p.cliente.rznSocial,
        cliente_ruc_dni:           p.cliente.numDoc,
        emitido_por:               p.emitidoPor,
        comprobante_referencia_id: p.referenciaId,
        intentos_envio:            clasif.reintentable ? 1 : 0,
        proximo_intento_at:        clasif.reintentable ? calcularProximoIntento(1) : null,
        ultimo_error_sunat:        !resultado.aceptado ? (resultado.error ?? resultado.cdrDescripcion ?? null) : null,
        requiere_atencion:         clasif.requiereAtencion,
        detalle_emision: {
          tipoNota: p.tipoNota, serie: p.serieBase,
          tipoDocAfectado: p.tipoDocAfectado, numDocAfectado: p.numDocAfectado,
          cliente: p.cliente, itemsLycet: p.itemsLycet,
          codMotivo: p.codMotivo, desMotivo: p.desMotivo,
        },
      })
      .select('id')
      .single()

    await escribirLog(
      p.supabase, p.ferreteriaId, comp?.id ?? null,
      'envio', 'note/send', resultado,
      { serie: p.serieBase, correlativo, ruc: creds.ruc, tipoDoc: p.tipoNota },
    )

    const etiqueta = p.tipoNota === '07' ? 'NC' : 'ND'
    if (clasif.reintentable) {
      return { ok: true, comprobanteId: comp?.id, numeroCompleto, error: `${etiqueta} en cola de reintento (SUNAT/servicio no disponible momentáneamente)` }
    }
    if (!resultado.ok)       return { ok: false, comprobanteId: comp?.id, error: resultado.error ?? `Error enviando ${etiqueta} a SUNAT` }
    if (!resultado.aceptado) return { ok: false, comprobanteId: comp?.id, error: resultado.cdrDescripcion ?? `SUNAT rechazó la ${etiqueta} (código ${resultado.cdrCodigo})` }

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
