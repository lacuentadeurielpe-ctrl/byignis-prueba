import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderToStream } from '@react-pdf/renderer'
import PlantillaCompra from '@/components/pdf/PlantillaCompra'
import React from 'react'

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

  // 1. Obtener compra y sus items
  const { data: compra, error: errComp } = await supabase
    .from('compras')
    .select('*, items_compra(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (errComp || !compra) {
    return new NextResponse('Compra no encontrada', { status: 404 })
  }

  // 2. Obtener ferreteria
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('*')
    .eq('id', session.ferreteriaId)
    .single()

  if (!ferreteria) {
    return new NextResponse('Ferreteria no encontrada', { status: 500 })
  }

  // 3. Preparar items
  const items = (compra.items_compra || []).map((i: any) => ({
    cantidad: Number(i.cantidad_comprada || i.cantidad || 0),
    descripcion: i.nombre_producto || i.producto_nombre || 'Producto sin nombre',
    precio_unitario: Number(i.precio_compra_unitario || i.precio_unitario || 0),
    subtotal: Number(i.subtotal || 0),
  }))

  // 4. Preparar data para la plantilla
  const data = {
    ferreteria: {
      razon_social: ferreteria.razon_social || ferreteria.nombre || 'FERRETERIA E.I.R.L',
      nombre_comercial: ferreteria.nombre_comercial || ferreteria.nombre,
      ruc: ferreteria.ruc || '00000000000',
      direccion: ferreteria.direccion || 'Lima, Peru',
    },
    compra: {
      numero_registro: compra.numero_compra || '',
      numero_factura: compra.numero_factura || '',
      tipo: (compra.tipo || 'informal') as any,
      fecha: compra.fecha_factura || compra.created_at,
      proveedor_nombre: compra.razon_social_proveedor || compra.proveedor_nombre || '',
      proveedor_ruc: compra.proveedor_ruc || '',
      subtotal: Number(compra.total_bruto || 0),
      igv: Number(compra.igv || 0),
      total: Number(compra.total_neto || 0),
      estado: compra.estado || 'borrador',
    },
    items,
  }

  // 5. Renderizar PDF
  try {
    const stream = await renderToStream(React.createElement(PlantillaCompra, { data }) as any)
    
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
        'Content-Disposition': `inline; filename="Compra_${data.compra.numero_registro}.pdf"`
      }
    })
  } catch (err) {
    console.error('Error renderizando PDF de compra', err)
    return new NextResponse('Error generando PDF', { status: 500 })
  }
}
