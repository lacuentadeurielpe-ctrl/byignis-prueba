import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ComprobantePDF } from '@/lib/pdf/comprobante'

export const dynamic = 'force-dynamic'

// GET /api/reabastecer/ordenes/[id]/pdf — Generar y previsualizar PDF de la proforma/orden de compra
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  // 1. Cargar orden de compra con sus items y proveedor
  const { data: orden, error } = await supabase
    .from('ordenes_compra')
    .select('*, items:items_orden_compra(*), proveedores(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (error || !orden) {
    return new Response('Orden de compra no encontrada', { status: 404 })
  }

  // 2. Cargar ferretería para obtener datos de cabecera y diseño
  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('nombre, direccion, telefono_whatsapp, logo_url, color_comprobante, mensaje_comprobante')
    .eq('id', session.ferreteriaId)
    .single()

  if (!ferreteria) {
    return new Response('Ferretería no encontrada', { status: 404 })
  }

  const ocNum = `OC-${orden.id.slice(0, 8).toUpperCase()}`

  // 3. Mapear datos al formato de ComprobantePDF (marcando esOrdenCompra = true)
  const datos = {
    nombre_ferreteria:    ferreteria.nombre,
    direccion_ferreteria: ferreteria.direccion,
    telefono_ferreteria:  ferreteria.telefono_whatsapp,
    logo_url:             ferreteria.logo_url,
    color:                ferreteria.color_comprobante || '#1e40af',
    mensaje_pie:          ferreteria.mensaje_comprobante,
    numero_comprobante:   ocNum,
    fecha_emision:        orden.created_at,
    esProforma:           orden.estado === 'pendiente',
    esOrdenCompra:        true,
    numero_pedido:        ocNum,
    nombre_cliente:       orden.proveedor_nombre,
    formas_pago:          [],
    proveedor_contacto:   orden.proveedores?.contacto || null,
    proveedor_telefono:   orden.proveedores?.telefono || null,
    items: (orden.items || []).map((i: any) => ({
      nombre_producto: i.nombre,
      unidad:          i.unidad,
      cantidad:        i.cantidad,
      precio_unitario: i.precio_compra, // costo de compra
      subtotal:        i.cantidad * i.precio_compra,
    })),
    total:                orden.total,
  }

  // 4. Renderizar PDF usando @react-pdf/renderer
  let pdfBuffer: Buffer
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(
      React.createElement(ComprobantePDF, { datos }) as any
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(`Error al generar PDF: ${msg}`, { status: 500 })
  }

  // 5. Devolver como stream de PDF
  return new Response(pdfBuffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ocNum}.pdf"`,
    },
  })
}
