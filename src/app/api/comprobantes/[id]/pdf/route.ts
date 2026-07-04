import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderToStream } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import React from 'react'
import { getPlantillaBoleta } from '@/components/pdf/boleta'
import { getPlantillaFactura } from '@/components/pdf/factura'
import { getPlantillaNotaVenta } from '@/components/pdf/nota-venta'
import { getPlantillaFactura as getPlantillaNotaCredito } from '@/components/pdf/factura' // Reuse factura for nota_credito by default
import { PropsPDF } from '@/components/pdf/shared/types'

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

  // 3. Generar QR
  let qrDataUri = ''
  if (comprobante.nubefact_qr_cadena) {
    try {
      qrDataUri = await QRCode.toDataURL(comprobante.nubefact_qr_cadena, {
        margin: 0,
        width: 150
      })
    } catch (e) {
      console.error('Error generando QR', e)
    }
  }

  // 4. Preparar data
  let rawItems = comprobante.pedidos?.items_pedido || []

  // Si es boleta o factura, filtrar para que solo vayan los productos facturables
  if (comprobante.tipo === 'boleta' || comprobante.tipo === 'factura') {
    rawItems = rawItems.filter((i: any) => i.productos?.facturable !== false)
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
    hash: comprobante.nubefact_hash || '',
    qr_data_uri: qrDataUri,
  }

  const tema = {
    primario: ferreteria.color_comprobante || '#1e40af',
    secundario: ferreteria.pdf_color_secundario || '#e67e22',
  }

  const propsPDF: PropsPDF = {
    emisor,
    comprobante: comprobanteData,
    items,
    tema
  }

  // 5. Elegir plantilla según tipo de comprobante
  const tipo = comprobante.tipo || ''
  let ComponentePDF: any

  if (tipo === 'boleta') {
    ComponentePDF = getPlantillaBoleta(ferreteria.pdf_formato_boleta || 'clasico')
  } else if (tipo === 'factura') {
    ComponentePDF = getPlantillaFactura(ferreteria.pdf_formato_factura || 'clasico')
  } else if (tipo === 'nota_credito') {
    ComponentePDF = getPlantillaNotaCredito('clasico')
  } else {
    // nota_venta, proforma o vacio
    ComponentePDF = getPlantillaNotaVenta(ferreteria.pdf_formato_nota_venta || 'ticket')
  }

  const component = React.createElement(ComponentePDF, propsPDF)

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
        'Content-Disposition': `inline; filename="${propsPDF.comprobante.numero_completo}.pdf"`
      }
    })
  } catch (err) {
    console.error('Error renderizando PDF', err)
    return new NextResponse('Error generando PDF', { status: 500 })
  }
}
