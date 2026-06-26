// Orquestador: genera PDF → sube a Storage → guarda en DB → envía por WhatsApp
// Usa el admin client para bypassear RLS (operación interna del sistema)

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WASender } from '@/lib/whatsapp/types'
import { resolverSender } from '@/lib/whatsapp/provider'
import { ComprobantePDF, type DatosComprobante } from './comprobante'

// Repositories
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'

/**
 * Pre-fetchea la imagen del logo y la convierte a base64 data URL.
 * @react-pdf/renderer necesita base64 o URLs absolutas estables.
 * Si falla (URL inaccesible, timeout, formato no soportado) devuelve null
 * y el componente usará las iniciales como fallback.
 */
async function fetchLogoBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: 'image/*' },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/png'
    // Solo aceptar formatos que react-pdf soporta bien
    if (!contentType.startsWith('image/')) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

export interface ResultadoComprobante {
  ok: boolean
  numero_comprobante?: string
  pdf_url?: string
  comprobante_id?: string
  enviado?: boolean
  error?: string
}

export async function generarYEnviarComprobante({
  pedidoId,
  ferreteriaId,
  esProforma = false,
  sender,
}: {
  pedidoId: string
  ferreteriaId: string
  esProforma?: boolean
  sender?: WASender
}): Promise<ResultadoComprobante> {
  const supabase = createAdminClient()
  const ventasRepo = new VentasRepository(supabase)
  const facturacionRepo = new FacturacionRepository(supabase)

  // ── 1. Cargar pedido con todos los datos necesarios ──────────────────────
  let pedido
  try {
    pedido = await ventasRepo.obtenerPedidoPorId(ferreteriaId, pedidoId)
  } catch (errPedido: any) {
    return { ok: false, error: `Pedido no encontrado: ${errPedido?.message}` }
  }

  // ── 2. Cargar ferretería ─────────────────────────────────────────────────
  let ferreteria
  try {
    ferreteria = await facturacionRepo.obtenerFerreteriaComprobanteInfo(ferreteriaId)
  } catch (errFerr: any) {
    return { ok: false, error: `Ferretería no encontrada: ${errFerr?.message}` }
  }

  // ── 3. Verificar si ya existe un comprobante para este pedido ────────────
  //    Si ya existe (proforma o definitivo) y fue enviado → deduplicación: no reenviar
  //    Si existe pero no fue enviado → reenviar usando el PDF ya generado
  const existente = await facturacionRepo.obtenerComprobantePorPedido(ferreteriaId, pedidoId, 'nota_venta')

  if (existente) {
    if (existente.enviado_whatsapp) {
      // Ya enviado → no volver a enviar (deduplicación)
      return {
        ok: true,
        numero_comprobante: existente.numero_comprobante,
        pdf_url: existente.pdf_url ?? undefined,
        comprobante_id: existente.id,
      }
    }

    // Existe pero no fue enviado (fallo anterior) → reintentar envío con el PDF existente
    const telefonoClienteR = (pedido as any).clientes?.telefono ?? pedido.telefono_cliente
    const fromR = ferreteria.telefono_whatsapp.replace(/^\+/, '')
    const filenameR = `${existente.numero_comprobante}.pdf`
    const captionR = esProforma
      ? `📋 *${ferreteria.nombre}*\nAquí está tu proforma N° ${existente.numero_comprobante} del pedido *${pedido.numero_pedido}*.\nCuando esté confirmado recibirás el comprobante oficial. 🙏`
      : `📄 *${ferreteria.nombre}*\nAquí está tu comprobante N° ${existente.numero_comprobante} del pedido *${pedido.numero_pedido}*. 🙏`

    try {
      if (sender && existente.pdf_url) {
        await sender.enviarDocumento({ to: telefonoClienteR, pdfUrl: existente.pdf_url, filename: filenameR, caption: captionR })
        await facturacionRepo.actualizarEnvioComprobante(existente.id, true, null)
      }
    } catch (_) { /* no fallar */ }

    return {
      ok: true,
      numero_comprobante: existente.numero_comprobante,
      pdf_url: existente.pdf_url ?? undefined,
      comprobante_id: existente.id,
    }
  }

  // ── 4. Generar número correlativo (atómico en DB) ────────────────────────
  let numero
  try {
    numero = await facturacionRepo.generarNumeroComprobante(ferreteriaId, 'nota_venta', 'NV02')
  } catch (errNum: any) {
    return { ok: false, error: `Error generando número: ${errNum?.message}` }
  }

  const numeroComprobante = `NV02-${String(numero).padStart(8, '0')}`

  // ── 5. Construir datos para el PDF ───────────────────────────────────────
  const items = ((pedido as any).items_pedido ?? []).map((i: any) => ({
    nombre_producto: i.nombre_producto,
    unidad: i.unidad,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.subtotal,
  }))

  // Pre-fetchear logo como base64 para que react-pdf no tenga que hacer HTTP fetch
  // en el runtime serverless (puede fallar con CORS/timeouts en URLs de Supabase Storage).
  const logoBase64 = ferreteria.logo_url
    ? await fetchLogoBase64(ferreteria.logo_url)
    : null

  // Derivar formas de pago: si formas_pago está vacío, usar metodos_pago_activos
  const METODO_LABELS: Record<string, string> = {
    efectivo: 'Efectivo', yape: 'Yape', plin: 'Plin',
    transferencia: 'Transferencia', mercadopago: 'Mercado Pago',
  }
  const metodosActivos = ((ferreteria as any).metodos_pago_activos as string[]) ?? []
  const formasPago = ((ferreteria.formas_pago as string[]) ?? []).length > 0
    ? (ferreteria.formas_pago as string[])
    : metodosActivos.map((m) => METODO_LABELS[m] ?? m)

  const datos: DatosComprobante = {
    nombre_ferreteria:  ferreteria.nombre,
    direccion_ferreteria: ferreteria.direccion ?? null,
    telefono_ferreteria: ferreteria.telefono_whatsapp,
    logo_url:           logoBase64,
    color:              (ferreteria.color_comprobante as string | null) ?? '#1e40af',
    mensaje_pie:        ferreteria.mensaje_comprobante ?? null,
    ruc_ferreteria:     (ferreteria as any).ruc ?? undefined,
    numero_comprobante: numeroComprobante,
    fecha_emision:      new Date().toISOString(),
    esProforma,
    tipoDocumento:      esProforma ? 'proforma' : 'nota_venta',
    numero_pedido:      pedido.numero_pedido,
    nombre_cliente:     pedido.nombre_cliente,
    modalidad:          pedido.modalidad,
    direccion_entrega:  pedido.direccion_entrega ?? null,
    formas_pago:        formasPago,
    items,
    total:              pedido.total,
  }

  // ── 6. Renderizar PDF ────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(
      React.createElement(ComprobantePDF, { datos }) as any
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Error renderizando PDF: ${msg}` }
  }

  // ── 7. Subir a Supabase Storage ──────────────────────────────────────────
  const storagePath = `${ferreteriaId}/${numeroComprobante}.pdf`

  const { error: errUpload } = await supabase.storage
    .from('comprobantes')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (errUpload) {
    return { ok: false, error: `Error subiendo PDF: ${errUpload.message}` }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('comprobantes')
    .getPublicUrl(storagePath)

  // ── 8. Guardar registro en DB ────────────────────────────────────────────
  let comprobante
  try {
    comprobante = await facturacionRepo.guardarComprobante({
      ferreteria_id:      ferreteriaId,
      pedido_id:          pedidoId,
      tipo:               'nota_venta',
      serie:              'NV02', // Serie diferente para los generales
      numero:             numero,
      numero_completo:    numeroComprobante,
      numero_comprobante: numeroComprobante,
      estado:             'emitido',
      subtotal:           pedido.total,
      igv:                0,
      total:              pedido.total,
      pdf_url:            publicUrl,
      cliente_nombre:     pedido.nombre_cliente,
      emitido_por:        'dashboard',
    })
  } catch (errInsert: any) {
    return { ok: false, error: `Error guardando comprobante: ${errInsert?.message}` }
  }

  // ── 9. Enviar por WhatsApp (con un reintento) ────────────────────────────
  const telefonoCliente = (pedido as any).clientes?.telefono ?? pedido.telefono_cliente
  const filename = `${numeroComprobante}.pdf`
  const caption = esProforma
    ? `📋 *${ferreteria.nombre}*\nAquí está tu proforma N° ${numeroComprobante} del pedido *${pedido.numero_pedido}*.\nCuando el encargado confirme el pedido recibirás el comprobante oficial. 🙏`
    : `📄 *${ferreteria.nombre}*\nAquí está tu comprobante N° ${numeroComprobante} del pedido *${pedido.numero_pedido}*. ¡Gracias por tu preferencia! 🙏`

  let enviado = false
  let errorEnvio: string | null = null

  if (sender) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        await sender.enviarDocumento({ to: telefonoCliente, pdfUrl: publicUrl, filename, caption })
        enviado = true
        break
      } catch (err) {
        errorEnvio = err instanceof Error ? err.message : String(err)
        if (intento === 0) await new Promise((r) => setTimeout(r, 2000))
      }
    }
  } else {
    errorEnvio = 'Sin proveedor WhatsApp configurado'
  }

  // ── 10. Actualizar estado de envío en DB ─────────────────────────────────
  await facturacionRepo.actualizarEnvioComprobante(comprobante.id, enviado, errorEnvio)

  if (errorEnvio) {
    console.error(`[Comprobante] Error enviando ${numeroComprobante}:`, errorEnvio)
  }

  return {
    ok: true,
    numero_comprobante: numeroComprobante,
    pdf_url: publicUrl,
    comprobante_id: comprobante.id,
  }
}

// ── PDF de cotización/proforma (sin pedido aún) ───────────────────────────────

export async function generarYEnviarCotizacionPDF({
  cotizacionId,
  ferreteriaId,
  telefonoCliente,
  nombreCliente,
  sender,
}: {
  cotizacionId: string
  ferreteriaId: string
  telefonoCliente: string
  nombreCliente?: string
  sender?: WASender
}): Promise<ResultadoComprobante> {
  const supabase = createAdminClient()
  const facturacionRepo = new FacturacionRepository(supabase)

  // ── 1. Cargar cotización + items ─────────────────────────────────────────────
  const { data: cotizacion, error: errCot } = await supabase
    .from('cotizaciones')
    .select('id, total, items_cotizacion(*)')
    .eq('id', cotizacionId)
    .eq('ferreteria_id', ferreteriaId)
    .single()

  if (errCot || !cotizacion) return { ok: false, error: 'Cotización no encontrada' }

  // ── 2. Cargar branding de la ferretería ──────────────────────────────────────
  let ferreteria
  try {
    ferreteria = await facturacionRepo.obtenerFerreteriaComprobanteInfo(ferreteriaId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Ferretería no encontrada: ${msg}` }
  }

  // ── 3. Pre-fetchear logo como base64 ─────────────────────────────────────────
  const logoBase64 = ferreteria.logo_url ? await fetchLogoBase64(ferreteria.logo_url) : null

  // ── 4. Número estable derivado del ID de cotización ───────────────────────────
  const cotIdShort = cotizacionId.replace(/-/g, '').slice(-8).toUpperCase()
  const numeroCotizacion = `COT-${cotIdShort}`

  // ── 5. Construir items (solo disponibles) ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemsRaw = ((cotizacion as any).items_cotizacion ?? []) as Array<Record<string, unknown>>
  const items = itemsRaw
    .filter((i) => !i.no_disponible)
    .map((i) => ({
      nombre_producto: String(i.nombre_producto ?? ''),
      unidad:          String(i.unidad ?? 'und'),
      cantidad:        Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      subtotal:        Number(i.subtotal),
    }))

  if (items.length === 0) return { ok: false, error: 'La cotización no tiene items disponibles' }

  // ── 6. Construir datos del PDF ────────────────────────────────────────────────
  const METODO_LABELS_COT: Record<string, string> = {
    efectivo: 'Efectivo', yape: 'Yape', plin: 'Plin',
    transferencia: 'Transferencia', mercadopago: 'Mercado Pago',
  }
  const metodosActivosCot = ((ferreteria as any).metodos_pago_activos as string[]) ?? []
  const formasPagoCot = ((ferreteria.formas_pago as string[]) ?? []).length > 0
    ? (ferreteria.formas_pago as string[])
    : metodosActivosCot.map((m) => METODO_LABELS_COT[m] ?? m)

  const datos: DatosComprobante = {
    nombre_ferreteria:    ferreteria.nombre,
    direccion_ferreteria: ferreteria.direccion ?? null,
    telefono_ferreteria:  ferreteria.telefono_whatsapp,
    logo_url:             logoBase64,
    color:                (ferreteria.color_comprobante as string | null) ?? '#1e40af',
    mensaje_pie:          ferreteria.mensaje_comprobante ?? null,
    ruc_ferreteria:       (ferreteria as any).ruc ?? undefined,
    numero_comprobante:   numeroCotizacion,
    fecha_emision:        new Date().toISOString(),
    esProforma:           true,
    tipoDocumento:        'cotizacion' as const,
    numero_pedido:        numeroCotizacion,
    nombre_cliente:       nombreCliente?.trim() || 'Cliente',
    modalidad:            'recojo',
    direccion_entrega:    null,
    formas_pago:          formasPagoCot,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    total: (cotizacion as any).total as number,
    items,
  }

  // ── 7. Renderizar PDF ─────────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(React.createElement(ComprobantePDF, { datos }) as any)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Error renderizando PDF: ${msg}` }
  }

  // ── 8. Subir a Storage ───────────────────────────────────────────────────────
  const storagePath = `${ferreteriaId}/cotizaciones/${numeroCotizacion}.pdf`
  const { error: errUpload } = await supabase.storage
    .from('comprobantes')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (errUpload) return { ok: false, error: `Error subiendo PDF: ${errUpload.message}` }

  const { data: { publicUrl } } = supabase.storage.from('comprobantes').getPublicUrl(storagePath)

  // ── 9. Enviar por WhatsApp ───────────────────────────────────────────────────
  let enviado = false

  if (sender) {
    try {
      await sender.enviarDocumento({
        to:       telefonoCliente,
        pdfUrl:   publicUrl,
        filename: `${numeroCotizacion}.pdf`,
        caption:  `📋 *${ferreteria.nombre}*\nAquí tienes tu cotización *${numeroCotizacion}*.\n_Precios válidos sujetos a disponibilidad._ 🙏`,
      })
      enviado = true
    } catch (e) {
      console.error('[generarYEnviarCotizacionPDF] Error enviando:', e)
    }
  }

  return {
    ok: true,
    numero_comprobante: numeroCotizacion,
    pdf_url:            publicUrl,
    enviado,
  }
}

// ── Eliminar comprobante de un pedido (para regenerarlo tras modificación) ────
export async function eliminarComprobantePedido(
  pedidoId: string,
  ferreteriaId: string,
): Promise<void> {
  const supabase = createAdminClient()
  const facturacionRepo = new FacturacionRepository(supabase)

  try {
    const comp = await facturacionRepo.eliminarComprobantePorPedido(ferreteriaId, pedidoId)
    if (!comp) return

    // Borrar PDF del storage
    const storagePath = `${ferreteriaId}/${comp.numero_comprobante}.pdf`
    await supabase.storage.from('comprobantes').remove([storagePath])
  } catch (e) {
    console.error('[Comprobante] Error al eliminar comprobante:', e)
  }
}

// ── Reenvío de comprobante existente ─────────────────────────────────────────
export async function reenviarComprobante({
  pedidoId,
  ferreteriaId,
}: {
  pedidoId: string
  ferreteriaId: string
}): Promise<ResultadoComprobante> {
  const supabase = createAdminClient()
  const ventasRepo = new VentasRepository(supabase)
  const facturacionRepo = new FacturacionRepository(supabase)

  // Obtener el comprobante existente
  const comprobante = await facturacionRepo.obtenerComprobantePorPedido(ferreteriaId, pedidoId, 'nota_venta')

  if (!comprobante) {
    return { ok: false, error: 'No existe un comprobante para este pedido' }
  }

  // Obtener datos de ferretería y pedido para el reenvío
  let ferreteria, pedido
  try {
    ferreteria = await facturacionRepo.obtenerFerreteriaInfo(ferreteriaId)
    pedido = await ventasRepo.obtenerPedidoPorId(ferreteriaId, pedidoId)
  } catch (error: any) {
    return { ok: false, error: 'Error obteniendo datos para el reenvío' }
  }

  const telefonoCliente = (pedido as any).clientes?.telefono ?? pedido.telefono_cliente
  const telefonoFerreteria = ferreteria.telefono_whatsapp.replace(/^\+/, '')
  const filename = `${comprobante.numero_comprobante}.pdf`
  const caption = `📄 *${ferreteria.nombre}*\nAquí está su comprobante N° ${comprobante.numero_comprobante} del pedido *${pedido.numero_pedido}* (reenvío). 🙏`

  try {
    if (comprobante.pdf_url) {
      const sender = await resolverSender(supabase, ferreteriaId, telefonoFerreteria)
      await sender?.enviarDocumento({ to: telefonoCliente, pdfUrl: comprobante.pdf_url, filename, caption })
    }

    await facturacionRepo.actualizarEnvioComprobante(comprobante.id, true, null)

    return {
      ok: true,
      numero_comprobante: comprobante.numero_comprobante,
      pdf_url: comprobante.pdf_url ?? undefined,
      comprobante_id: comprobante.id,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await facturacionRepo.actualizarEnvioComprobante(comprobante.id, false, msg)
    return { ok: false, error: msg }
  }
}
