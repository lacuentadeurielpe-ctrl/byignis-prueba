// Orquestador: genera PDF → sube a Storage → guarda en DB → envía por WhatsApp
// Usa el admin client para bypassear RLS (operación interna del sistema)

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarDocumento } from '@/lib/whatsapp/ycloud'
import { ComprobantePDF, type DatosComprobante } from './comprobante'

// Repositories
import { VentasRepository } from '@/lib/db/repositories/ventas'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'

export interface ResultadoComprobante {
  ok: boolean
  numero_comprobante?: string
  pdf_url?: string
  comprobante_id?: string
  error?: string
}

export async function generarYEnviarComprobante({
  pedidoId,
  ferreteriaId,
  esProforma = false,
  ycloudApiKey,
}: {
  pedidoId: string
  ferreteriaId: string
  esProforma?: boolean
  /** api_key del tenant (desencriptada). Si no se pasa, usa YCLOUD_API_KEY del env */
  ycloudApiKey?: string
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
      const apiKeyR = ycloudApiKey ?? process.env.YCLOUD_API_KEY
      if (apiKeyR && existente.pdf_url) {
        await enviarDocumento({ from: fromR, to: telefonoClienteR, pdfUrl: existente.pdf_url, filename: filenameR, caption: captionR, apiKey: ycloudApiKey })
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

  const datos: DatosComprobante = {
    nombre_ferreteria:  ferreteria.nombre,
    direccion_ferreteria: ferreteria.direccion ?? null,
    telefono_ferreteria: ferreteria.telefono_whatsapp,
    logo_url:           ferreteria.logo_url ?? null,
    color:              ferreteria.color_comprobante ?? '#1e40af',
    mensaje_pie:        ferreteria.mensaje_comprobante ?? null,
    numero_comprobante: numeroComprobante,
    fecha_emision:      new Date().toISOString(),
    esProforma,
    numero_pedido:      pedido.numero_pedido,
    nombre_cliente:     pedido.nombre_cliente,
    modalidad:          pedido.modalidad,
    direccion_entrega:  pedido.direccion_entrega ?? null,
    formas_pago:        (ferreteria.formas_pago as string[]) ?? [],
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
  const from = ferreteria.telefono_whatsapp.replace(/^\+/, '')
  const filename = `${numeroComprobante}.pdf`
  const caption = esProforma
    ? `📋 *${ferreteria.nombre}*\nAquí está tu proforma N° ${numeroComprobante} del pedido *${pedido.numero_pedido}*.\nCuando el encargado confirme el pedido recibirás el comprobante oficial. 🙏`
    : `📄 *${ferreteria.nombre}*\nAquí está tu comprobante N° ${numeroComprobante} del pedido *${pedido.numero_pedido}*. ¡Gracias por tu preferencia! 🙏`

  let enviado = false
  let errorEnvio: string | null = null

  const apiKeyEnvio = ycloudApiKey ?? process.env.YCLOUD_API_KEY
  for (let intento = 0; intento < 2; intento++) {
    try {
      if (apiKeyEnvio && apiKeyEnvio !== 'your_ycloud_api_key') {
        await enviarDocumento({ from, to: telefonoCliente, pdfUrl: publicUrl, filename, caption, apiKey: ycloudApiKey })
        enviado = true
        break
      } else {
        // YCloud no configurado — registrar pero no fallar
        errorEnvio = 'YCloud API key no configurada'
        break
      }
    } catch (err) {
      errorEnvio = err instanceof Error ? err.message : String(err)
      if (intento === 0) {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
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
  const from = ferreteria.telefono_whatsapp.replace(/^\+/, '')
  const filename = `${comprobante.numero_comprobante}.pdf`
  const caption = `📄 *${ferreteria.nombre}*\nAquí está su comprobante N° ${comprobante.numero_comprobante} del pedido *${pedido.numero_pedido}* (reenvío). 🙏`

  try {
    if (process.env.YCLOUD_API_KEY && process.env.YCLOUD_API_KEY !== 'your_ycloud_api_key' && comprobante.pdf_url) {
      await enviarDocumento({
        from,
        to: telefonoCliente,
        pdfUrl: comprobante.pdf_url,
        filename,
        caption,
      })
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
