// Adaptador SUNAT Directo → interfaz ProveedorFacturacion
// Motor: Lycet (REST API oficial de Greenter — github.com/giansalex/lycet)
//
// Lycet recibe JSON, construye el XML UBL 2.1, lo firma con el certificado PEM
// y lo envía a SUNAT vía SOAP. Configura la empresa una vez por emisión (idempotente).
//
// Variables de entorno requeridas en Vercel + Railway:
//   LYCET_BASE_URL — URL del servicio Lycet desplegado en Railway
//   LYCET_API_TOKEN — token de autenticación del servicio Lycet

import { desencriptar, encriptar } from '@/lib/encryption'
import { crearNotaVentaInterna } from '@/lib/comprobantes/nota-venta'
import { pfxAPem } from './lycet/cert'
import {
  mapearInvoice, mapearNota,
  type EmisorLycet, type ClienteLycet, type ItemLycet,
} from './lycet/mappers'
import {
  ensureCompany, enviarInvoice, enviarNota,
  type LycetConfig, type ResultadoSunat,
} from './lycet/client'
import type {
  ProveedorFacturacion,
  OpcionesEmisionBoleta,
  OpcionesEmisionFactura,
  OpcionesNotaCredito,
  ResultadoEmisionUnificado,
} from './types'

// ── Config Lycet desde env ────────────────────────────────────────────────────
function getLycetConfig(): LycetConfig {
  const baseUrl = process.env.LYCET_BASE_URL
  const token   = process.env.LYCET_API_TOKEN
  if (!baseUrl || !token) {
    throw new Error(
      'El servicio de facturación no está disponible (LYCET_BASE_URL / LYCET_API_TOKEN no configurados). Contacta al administrador.',
    )
  }
  return { baseUrl, token }
}

// ── Credenciales desencriptadas en memoria ────────────────────────────────────
interface CredencialesCargadas {
  ruc:         string
  razonSocial: string
  solUsuario:  string
  solClave:    string
  certPem:     string   // certificado + clave privada PEM (lo que Lycet necesita)
  modo:        'beta' | 'produccion'
}

async function cargarCredenciales(supabase: any, ferreteriaId: string): Promise<CredencialesCargadas | null> {
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

// ── Helpers de base de datos ──────────────────────────────────────────────────
async function obtenerFerreteria(supabase: any, ferreteriaId: string) {
  const { data } = await supabase
    .from('ferreterias')
    .select('id, ruc, razon_social, serie_boletas, serie_facturas, igv_incluido_en_precios, direccion')
    .eq('id', ferreteriaId)
    .single()
  return data
}

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

function buildEmisor(ferreteria: any, creds: CredencialesCargadas): EmisorLycet {
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

async function registrarEmpresaEnLycet(
  lycetCfg: LycetConfig,
  creds: CredencialesCargadas,
): Promise<{ ok: boolean; error?: string }> {
  return ensureCompany(lycetCfg, {
    ruc:     creds.ruc,
    solUser: creds.solUsuario,
    solPass: creds.solClave,
    certPem: creds.certPem,
    feUrl:   creds.modo === 'beta' ? FE_BETA_URL : undefined,
  })
}

// ── Estado SUNAT a partir del resultado normalizado ───────────────────────────
function estadoSunat(res: ResultadoSunat): 'borrador' | 'aceptado' | 'aceptado_obs' | 'rechazado' {
  if (!res.ok || !res.aceptado) return 'rechazado'
  const n = res.cdrCodigo != null && /^\d+$/.test(res.cdrCodigo)
    ? parseInt(res.cdrCodigo, 10)
    : 0
  return n >= 4000 ? 'aceptado_obs' : 'aceptado'
}

// ── Reserva atómica de correlativo ────────────────────────────────────────────
async function reservarCorrelativo(
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

async function rollbackCorrelativo(
  supabase: any,
  ferreteriaId: string,
  tipoDoc: string,
  serie: string,
  correlativo: number,
) {
  await supabase.rpc('rollback_correlativo_serie', {
    p_ferreteria_id: ferreteriaId,
    p_tipo_doc:      tipoDoc,
    p_serie:         serie,
    p_correlativo:   correlativo,
  }).catch(() => {})
}

// ── Bitácora SUNAT (no crítica — errores son silenciados) ─────────────────────
async function escribirLog(
  supabase: any,
  ferreteriaId: string,
  comprobanteId: string | null,
  direccion: 'envio' | 'consulta' | 'resumen' | 'baja' | 'test',
  endpoint: string,
  resultado: ResultadoSunat,
  requestResumen?: any,
) {
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
  }).catch(() => {})
}

function fechaEmisionHoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

function padCorrelativo(n: number) {
  return String(n).padStart(8, '0')
}

// ─────────────────────────────────────────────────────────────────────────────
export class SunatDirectoAdapter implements ProveedorFacturacion {
  nombre = 'sunat_directo' as const

  // ── Boleta ─────────────────────────────────────────────────────────────────
  async emitirBoleta(opts: OpcionesEmisionBoleta): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredenciales(opts.supabase, opts.ferreteriaId)
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
    const estadoFinal = estadoSunat(resultado)
    const numeroCompleto = `${serie}-${padCorrelativo(correlativo)}`

    if (!resultado.aceptado) {
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
        estado:                resultado.aceptado ? 'emitido' : 'error',
        estado_sunat:          estadoFinal,
        fecha_emision:         fechaEmisionHoy(),
        moneda:                'PEN',
        subtotal:              totales.mtoOperGravadas,
        igv:                   totales.mtoIGV,
        total:                 totales.mtoImpVenta,
        sunat_cdr_codigo:      resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        cdr_notas:             resultado.cdrNotas ?? null,
        cliente_nombre:        opts.clienteNombre,
        cliente_ruc_dni:       opts.clienteDni.replace(/\D/g, '') || null,
        emitido_por:           opts.emitidoPor,
      }, { onConflict: 'pedido_id,tipo' })
      .select('id')
      .single()

    await escribirLog(
      opts.supabase, opts.ferreteriaId, comp?.id ?? null,
      'envio', 'invoice/send', resultado,
      { serie, correlativo, ruc: creds.ruc, tipoDoc: '03' },
    )

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
    const creds = await cargarCredenciales(opts.supabase, opts.ferreteriaId)
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
    const estadoFinal = estadoSunat(resultado)
    const numeroCompleto = `${serie}-${padCorrelativo(correlativo)}`

    if (!resultado.aceptado) {
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
        estado:                resultado.aceptado ? 'emitido' : 'error',
        estado_sunat:          estadoFinal,
        fecha_emision:         fechaEmisionHoy(),
        moneda:                'PEN',
        subtotal:              totales.mtoOperGravadas,
        igv:                   totales.mtoIGV,
        total:                 totales.mtoImpVenta,
        sunat_cdr_codigo:      resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion: resultado.cdrDescripcion ?? null,
        cdr_notas:             resultado.cdrNotas ?? null,
        cliente_nombre:        opts.clienteNombre,
        cliente_ruc_dni:       clienteRucLimpio,
        emitido_por:           opts.emitidoPor,
      }, { onConflict: 'pedido_id,tipo' })
      .select('id')
      .single()

    await escribirLog(
      opts.supabase, opts.ferreteriaId, comp?.id ?? null,
      'envio', 'invoice/send', resultado,
      { serie, correlativo, ruc: creds.ruc, tipoDoc: '01' },
    )

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

  // ── Nota de Crédito ────────────────────────────────────────────────────────
  async emitirNotaCredito(opts: OpcionesNotaCredito): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredenciales(opts.supabase, opts.ferreteriaId)
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
        fecha_emision:             fechaEmisionHoy(),
        moneda:                    'PEN',
        subtotal:                  totales.mtoOperGravadas,
        igv:                       totales.mtoIGV,
        total:                     totales.mtoImpVenta,
        sunat_cdr_codigo:          resultado.cdrCodigo ?? null,
        sunat_cdr_descripcion:     resultado.cdrDescripcion ?? null,
        cdr_notas:                 resultado.cdrNotas ?? null,
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

    return { ok: true, comprobanteId: comp?.id, numeroCompleto }
  }

  // ── Boleta de prueba (homologación SUNAT) ──────────────────────────────────
  async emitirBoletaPrueba(opts: {
    supabase:     any
    ferreteriaId: string
    indice:       number
  }): Promise<ResultadoEmisionUnificado & { cdrCodigo?: string }> {
    const creds = await cargarCredenciales(opts.supabase, opts.ferreteriaId)
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
