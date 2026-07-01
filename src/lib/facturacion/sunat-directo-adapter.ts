// Adaptador SUNAT Directo → interfaz ProveedorFacturacion
// Llama al microservicio Greenter (PHP dockerizado) que maneja:
//   - Generación del XML UBL 2.1
//   - Firma digital XAdES-BES con el certificado del tenant
//   - Compresión ZIP + envío SOAP a SUNAT
//   - Parseo del CDR de respuesta

import { desencriptar } from '@/lib/encryption'
import type {
  ProveedorFacturacion,
  OpcionesEmisionBoleta,
  OpcionesEmisionFactura,
  OpcionesNotaCredito,
  ResultadoEmisionUnificado,
} from './types'

// Estructura de credenciales cargadas desde sunat_credenciales
interface CredencialesSunat {
  ruc:          string
  razonSocial:  string
  solUsuario:   string   // ya desencriptado
  solClave:     string   // ya desencriptado
  certPfxB64:   string   // ya desencriptado (base64 del .pfx)
  certClave:    string   // ya desencriptado
  greenterUrl:  string
  modo:         'beta' | 'produccion'
}

// Respuesta del microservicio Greenter
interface GreenterRespuesta {
  ok:             boolean
  numero_completo?: string
  pdf_url?:       string
  xml_url?:       string
  cdr_codigo?:    string   // código CDR de SUNAT (0 = aceptado)
  cdr_descripcion?: string
  error?:         string
}

const TIMEOUT_MS = 30_000

async function cargarCredenciales(supabase: any, ferreteriaId: string): Promise<CredencialesSunat | null> {
  const { data } = await supabase
    .from('sunat_credenciales')
    .select('ruc, razon_social, sol_usuario_enc, sol_clave_enc, cert_pfx_enc, cert_clave_enc, greenter_url, modo')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'activo')
    .single()

  if (!data) return null

  try {
    const [solUsuario, solClave, certPfxB64, certClave] = await Promise.all([
      desencriptar(data.sol_usuario_enc),
      desencriptar(data.sol_clave_enc),
      desencriptar(data.cert_pfx_enc),
      desencriptar(data.cert_clave_enc),
    ])
    return {
      ruc:         data.ruc,
      razonSocial: data.razon_social,
      solUsuario,
      solClave,
      certPfxB64,
      certClave,
      greenterUrl: data.greenter_url,
      modo:        data.modo,
    }
  } catch {
    return null
  }
}

async function llamarGreenter(
  url: string,
  endpoint: string,
  payload: object
): Promise<GreenterRespuesta> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { ok: false, error: `Greenter ${res.status}: ${txt.slice(0, 200)}` }
    }

    return await res.json()
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error && e.name === 'AbortError'
      ? 'Tiempo de espera agotado al conectar con el servicio SUNAT (>30s)'
      : `Error de red con microservicio SUNAT: ${e instanceof Error ? e.message : String(e)}`
    return { ok: false, error: msg }
  }
}

function mapearItems(supabase: any, pedidoId: string): Promise<any[]> {
  return supabase
    .from('pedidos')
    .select('items_pedido(nombre_producto, cantidad, precio_unitario, unidad, productos(facturable))')
    .eq('id', pedidoId)
    .single()
    .then(({ data }: any) => data?.items_pedido ?? [])
}

async function obtenerFerreteria(supabase: any, ferreteriaId: string): Promise<any> {
  const { data } = await supabase
    .from('ferreterias')
    .select('id, ruc, razon_social, serie_boletas, serie_facturas, igv_incluido_en_precios, direccion, ubigeo, departamento, provincia, distrito')
    .eq('id', ferreteriaId)
    .single()
  return data
}

export class SunatDirectoAdapter implements ProveedorFacturacion {
  nombre = 'sunat_directo' as const

  async emitirBoleta(opts: OpcionesEmisionBoleta): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredenciales(opts.supabase, opts.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado o inactivo. Ve a Settings → Integraciones → SUNAT Directo.', tokenInvalido: true }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const { data: corrData } = await opts.supabase
      .rpc('generar_numero_comprobante', {
        p_ferreteria_id: opts.ferreteriaId,
        p_tipo:          'boleta',
        p_serie:         ferreteria.serie_boletas ?? 'B001',
      })
    if (!corrData) return { ok: false, error: 'Error generando correlativo' }

    const items = await mapearItems(opts.supabase, opts.pedidoId)
    // Solo los productos explícitamente marcados facturable=true van al XML SUNAT
    const itemsFormales = items.filter((i: any) => i.productos?.facturable === true)
    if (itemsFormales.length === 0) return { ok: false, error: 'No hay productos facturables en este pedido (todos tienen facturable=false o no están en catálogo)' }

    const respuesta = await llamarGreenter(creds.greenterUrl, 'boleta/emitir', {
      modo:         creds.modo,
      emisor: {
        ruc:          creds.ruc,
        razon_social: creds.razonSocial,
        serie:        ferreteria.serie_boletas ?? 'B001',
        numero:       corrData,
        direccion:    ferreteria.direccion ?? '-',
        ubigeo:       ferreteria.ubigeo ?? '150101',
        departamento: ferreteria.departamento ?? 'LIMA',
        provincia:    ferreteria.provincia ?? 'LIMA',
        distrito:     ferreteria.distrito ?? 'LIMA',
      },
      sol: { usuario: creds.solUsuario, clave: creds.solClave },
      certificado: { pfx_base64: creds.certPfxB64, clave: creds.certClave },
      cliente: {
        tipo_doc:  opts.clienteDni.replace(/\D/g, '').length === 8 ? '1' : '0',
        numero_doc: opts.clienteDni.replace(/\D/g, '') || '00000000',
        nombre:    opts.clienteNombre || 'CLIENTES VARIOS',
      },
      igv_incluido: ferreteria.igv_incluido_en_precios ?? false,
      items: itemsFormales.map((i: any) => ({
        descripcion:    i.nombre_producto,
        cantidad:       i.cantidad,
        precio_unitario: i.precio_unitario,
        unidad:         i.unidad ?? 'NIU',
      })),
    })

    if (!respuesta.ok) return { ok: false, error: respuesta.error }

    // Guardar en comprobantes
    const serie = ferreteria.serie_boletas ?? 'B001'
    const numero = corrData as number
    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .upsert({
        ferreteria_id:    opts.ferreteriaId,
        pedido_id:        opts.pedidoId,
        tipo:             'boleta',
        serie,
        numero,
        numero_completo:  respuesta.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
        numero_comprobante: respuesta.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
        estado:           'emitido',
        pdf_url:          respuesta.pdf_url ?? null,
        xml_url:          respuesta.xml_url ?? null,
        cliente_nombre:   opts.clienteNombre,
        cliente_ruc_dni:  opts.clienteDni.replace(/\D/g, '') || null,
        emitido_por:      opts.emitidoPor,
      }, { onConflict: 'pedido_id,tipo' })
      .select('id')
      .single()

    return {
      ok:            true,
      comprobanteId: comp?.id,
      numeroCompleto: respuesta.numero_completo,
      pdfUrl:        respuesta.pdf_url,
      xmlUrl:        respuesta.xml_url,
    }
  }

  async emitirFactura(opts: OpcionesEmisionFactura): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredenciales(opts.supabase, opts.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado. Ve a Settings → Integraciones → SUNAT Directo.', tokenInvalido: true }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    if (!ferreteria) return { ok: false, error: 'Negocio no encontrado' }

    const { data: corrData } = await opts.supabase
      .rpc('generar_numero_comprobante', {
        p_ferreteria_id: opts.ferreteriaId,
        p_tipo:          'factura',
        p_serie:         ferreteria.serie_facturas ?? 'F001',
      })
    if (!corrData) return { ok: false, error: 'Error generando correlativo' }

    const clienteRucLimpio = opts.clienteRuc.replace(/\D/g, '')
    if (clienteRucLimpio.length !== 11) {
      return { ok: false, error: `RUC inválido: debe tener 11 dígitos (recibido: "${clienteRucLimpio}")` }
    }

    const items = await mapearItems(opts.supabase, opts.pedidoId)
    const itemsFormales = items.filter((i: any) => i.productos?.facturable === true)
    if (itemsFormales.length === 0) return { ok: false, error: 'No hay productos facturables en este pedido' }

    const respuesta = await llamarGreenter(creds.greenterUrl, 'factura/emitir', {
      modo:         creds.modo,
      emisor: {
        ruc:          creds.ruc,
        razon_social: creds.razonSocial,
        serie:        ferreteria.serie_facturas ?? 'F001',
        numero:       corrData,
        direccion:    ferreteria.direccion ?? '-',
        ubigeo:       ferreteria.ubigeo ?? '150101',
        departamento: ferreteria.departamento ?? 'LIMA',
        provincia:    ferreteria.provincia ?? 'LIMA',
        distrito:     ferreteria.distrito ?? 'LIMA',
      },
      sol: { usuario: creds.solUsuario, clave: creds.solClave },
      certificado: { pfx_base64: creds.certPfxB64, clave: creds.certClave },
      cliente: {
        tipo_doc:   '6',  // RUC
        numero_doc: clienteRucLimpio,
        nombre:     opts.clienteNombre,
      },
      igv_incluido: ferreteria.igv_incluido_en_precios ?? false,
      items: itemsFormales.map((i: any) => ({
        descripcion:    i.nombre_producto,
        cantidad:       i.cantidad,
        precio_unitario: i.precio_unitario,
        unidad:         i.unidad ?? 'NIU',
      })),
    })

    if (!respuesta.ok) return { ok: false, error: respuesta.error }

    const serie = ferreteria.serie_facturas ?? 'F001'
    const numero = corrData as number
    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .upsert({
        ferreteria_id:    opts.ferreteriaId,
        pedido_id:        opts.pedidoId,
        tipo:             'factura',
        serie,
        numero,
        numero_completo:  respuesta.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
        numero_comprobante: respuesta.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
        estado:           'emitido',
        pdf_url:          respuesta.pdf_url ?? null,
        xml_url:          respuesta.xml_url ?? null,
        cliente_nombre:   opts.clienteNombre,
        cliente_ruc_dni:  clienteRucLimpio,
        emitido_por:      opts.emitidoPor,
      }, { onConflict: 'pedido_id,tipo' })
      .select('id')
      .single()

    return {
      ok:            true,
      comprobanteId: comp?.id,
      numeroCompleto: respuesta.numero_completo,
      pdfUrl:        respuesta.pdf_url,
      xmlUrl:        respuesta.xml_url,
    }
  }

  async emitirNotaCredito(opts: OpcionesNotaCredito): Promise<ResultadoEmisionUnificado> {
    const creds = await cargarCredenciales(opts.supabase, opts.ferreteriaId)
    if (!creds) return { ok: false, error: 'SUNAT Directo no configurado.', tokenInvalido: true }

    // Carga el comprobante referenciado
    const { data: ref } = await opts.supabase
      .from('comprobantes')
      .select('*, pedidos(id, items_pedido(*))')
      .eq('id', opts.comprobanteReferenciaId)
      .eq('ferreteria_id', opts.ferreteriaId)
      .single()

    if (!ref || ref.estado !== 'emitido') return { ok: false, error: 'Comprobante original no encontrado o no emitido' }

    const ferreteria = await obtenerFerreteria(opts.supabase, opts.ferreteriaId)
    const isBoleta = ref.tipo === 'boleta'
    const serie = isBoleta ? 'BC01' : 'FC01'

    const { data: corrData } = await opts.supabase
      .rpc('generar_numero_comprobante', {
        p_ferreteria_id: opts.ferreteriaId,
        p_tipo:          'nota_credito',
        p_serie:         serie,
      })
    if (!corrData) return { ok: false, error: 'Error generando correlativo NC' }

    let originalItems = (ref.pedidos?.items_pedido ?? []) as any[]
    if (opts.itemsDevueltos?.length) {
      originalItems = originalItems
        .map((oi: any) => {
          const dev = opts.itemsDevueltos!.find(d => d.producto_id === oi.producto_id)
          return dev ? { ...oi, cantidad: dev.cantidad } : null
        })
        .filter(Boolean)
    }

    const respuesta = await llamarGreenter(creds.greenterUrl, 'nota-credito/emitir', {
      modo:         creds.modo,
      emisor: { ruc: creds.ruc, razon_social: creds.razonSocial, serie, numero: corrData },
      sol: { usuario: creds.solUsuario, clave: creds.solClave },
      certificado: { pfx_base64: creds.certPfxB64, clave: creds.certClave },
      documento_referencia: { tipo: isBoleta ? '03' : '01', serie: ref.serie, numero: String(ref.numero) },
      motivo_codigo:        opts.motivoCodigo,
      motivo_descripcion:   opts.motivoDescripcion,
      cliente: { tipo_doc: isBoleta ? '1' : '6', numero_doc: ref.cliente_ruc_dni || '00000000', nombre: ref.cliente_nombre || 'CLIENTES VARIOS' },
      igv_incluido: ferreteria?.igv_incluido_en_precios ?? false,
      items: originalItems.map((i: any) => ({
        descripcion: i.nombre_producto, cantidad: i.cantidad,
        precio_unitario: i.precio_unitario, unidad: i.unidad ?? 'NIU',
      })),
    })

    if (!respuesta.ok) return { ok: false, error: respuesta.error }

    const numero = corrData as number
    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .insert({
        ferreteria_id:             opts.ferreteriaId,
        pedido_id:                 ref.pedido_id,
        tipo:                      'nota_credito',
        serie,
        numero,
        numero_completo:           respuesta.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
        numero_comprobante:        respuesta.numero_completo ?? `${serie}-${String(numero).padStart(8, '0')}`,
        estado:                    'emitido',
        pdf_url:                   respuesta.pdf_url ?? null,
        xml_url:                   respuesta.xml_url ?? null,
        cliente_nombre:            ref.cliente_nombre,
        cliente_ruc_dni:           ref.cliente_ruc_dni,
        emitido_por:               opts.emitidoPor,
        comprobante_referencia_id: ref.id,
      })
      .select('id')
      .single()

    return { ok: true, comprobanteId: comp?.id, numeroCompleto: respuesta.numero_completo, pdfUrl: respuesta.pdf_url, xmlUrl: respuesta.xml_url }
  }
}
