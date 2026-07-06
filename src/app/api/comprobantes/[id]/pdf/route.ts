import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderToStream } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import React from 'react'
import { getPlantillaBoleta } from '@/components/pdf/boleta'
import { getPlantillaFactura } from '@/components/pdf/factura'
import { getPlantillaNotaVenta } from '@/components/pdf/nota-venta'
import { getPlantillaNota } from '@/components/pdf/nota-credito'
import { PropsPDF } from '@/components/pdf/shared/types'
import { PropsNota } from '@/components/pdf/nota-credito/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionInfo()
  if (!session) {
    return new NextResponse('No autorizado', { status: 401 })
  }

  const supabase = createAdminClient()

  const { id } = await params

  // 1. Obtener comprobante
  const { data: comprobante, error: errComp } = await supabase
    .from('comprobantes')
    .select('*, pedidos(items_pedido(*, productos(facturable)))')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errComp || !comprobante) {
    return new NextResponse('Comprobante no encontrado', { status: 404 })
  }

  // 2. Obtener ferreteria
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('*')
    .eq('id', session.ferreteriaId)
    .single()

  if (!ferreteria) {
    return new NextResponse('Error interno', { status: 500 })
  }

  // 3. Generar QR (cadena estándar SUNAT guardada al emitir)
  let qrDataUri = ''
  const qrCadena = comprobante.qr_cadena
  if (qrCadena) {
    try {
      qrDataUri = await QRCode.toDataURL(qrCadena, {
        margin: 0,
        width: 150
      })
    } catch (e) {
      console.error('Error generando QR', e)
    }
  }

  // 4. Preparar data
  // NC/ND: el PDF debe reflejar EXACTAMENTE lo que se envió a SUNAT (el snapshot
  // `detalle_emision.itemsLycet`), no los ítems del pedido completo — una NC de
  // "devolución parcial" o "descuento global" no tiene los mismos ítems que el
  // pedido original. Solo se cae al pedido completo si es un comprobante viejo
  // emitido antes de que existiera el snapshot (detalle_emision null).
  const esNota = comprobante.tipo === 'nota_credito' || comprobante.tipo === 'nota_debito'
  const itemsSnapshot = comprobante.detalle_emision?.itemsLycet as
    { descripcion: string; cantidad: number; precioUnitario: number }[] | undefined

  let rawItems: any[]
  if (esNota && itemsSnapshot?.length) {
    rawItems = itemsSnapshot.map((i) => ({
      cantidad: i.cantidad,
      nombre_producto: i.descripcion,
      precio_unitario: i.precioUnitario,
      subtotal: i.precioUnitario * i.cantidad,
    }))
  } else {
    rawItems = comprobante.pedidos?.items_pedido || []
    // Si es boleta o factura, filtrar para que solo vayan los productos facturables
    if (comprobante.tipo === 'boleta' || comprobante.tipo === 'factura') {
      rawItems = rawItems.filter((i: any) => i.productos?.facturable !== false)
    }
  }

  const items = rawItems.map((i: any) => ({
    cantidad: i.cantidad,
    descripcion: i.nombre_producto,
    precio_unitario: i.precio_unitario,
    subtotal: i.subtotal,
  }))

  const emisor = {
    razon_social: ferreteria.razon_social || ferreteria.nombre || 'MI FERRETERIA E.I.R.L',
    nombre_comercial: ferreteria.nombre_comercial || ferreteria.nombre,
    ruc: ferreteria.ruc || '00000000000',
    direccion: ferreteria.direccion || 'Lima, Peru',
    logo_url: ferreteria.logo_url || null,
  }

  const comprobanteData = {
    numero_completo: comprobante.numero_completo || comprobante.numero_comprobante || '',
    fecha: comprobante.created_at,
    cliente_nombre: comprobante.cliente_nombre || 'CLIENTES VARIOS',
    cliente_doc: comprobante.cliente_ruc_dni || '',
    subtotal: comprobante.subtotal || 0,
    igv: comprobante.igv || 0,
    total: comprobante.total || 0,
    hash: comprobante.hash_cpe || '',
    qr_data_uri: qrDataUri,
  }

  const tema = {
    primario: ferreteria.color_comprobante || '#1e40af',
    secundario: ferreteria.pdf_color_secundario || '#e67e22',
  }

  // 5. Elegir plantilla según tipo de comprobante
  const tipo = comprobante.tipo || ''
  let ComponentePDF: any
  let props: PropsPDF | PropsNota

  if (tipo === 'boleta') {
    ComponentePDF = getPlantillaBoleta(ferreteria.pdf_formato_boleta || 'clasico')
    props = { emisor, comprobante: comprobanteData, items, tema }
  } else if (tipo === 'factura') {
    ComponentePDF = getPlantillaFactura(ferreteria.pdf_formato_factura || 'clasico')
    props = { emisor, comprobante: comprobanteData, items, tema }
  } else if (esNota) {
    ComponentePDF = getPlantillaNota()
    const snap = comprobante.detalle_emision
    props = {
      emisor, comprobante: comprobanteData, items, tema,
      tipoNota:          tipo === 'nota_debito' ? 'debito' : 'credito',
      documentoAfectado: snap?.numDocAfectado ?? '—',
      motivoDescripcion: snap?.desMotivo ?? '',
    } satisfies PropsNota
  } else {
    // nota_venta, proforma o vacio
    ComponentePDF = getPlantillaNotaVenta(ferreteria.pdf_formato_nota_venta || 'ticket')
    props = { emisor, comprobante: comprobanteData, items, tema }
  }

  const component = React.createElement(ComponentePDF, props)

  // 6. Renderizar PDF
  try {
    const stream = await renderToStream(component as any)
    
    // Convert Node.js stream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk))
        })
        stream.on('end', () => {
          controller.close()
        })
        stream.on('error', (err) => {
          controller.error(err)
        })
      }
    })

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${comprobanteData.numero_completo}.pdf"`
      }
    })
  } catch (err) {
    console.error('Error renderizando PDF', err)
    return new NextResponse('Error generando PDF', { status: 500 })
  }
}
