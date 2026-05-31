import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { OrdenCompraPDF } from '@/lib/pdf/orden-compra'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: orden, error } = await supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*)')
    .eq('id', id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (error || !orden) {
    return new Response('Orden de compra no encontrada', { status: 404 })
  }

  const { data: ferreteria } = await supabase
    .from('ferreterias')
    .select('nombre, direccion, telefono_whatsapp, logo_url')
    .eq('id', session.ferreteriaId)
    .single()

  if (!ferreteria) {
    return new Response('Ferretería no encontrada', { status: 404 })
  }

  const datos = {
    nombre_ferreteria: ferreteria.nombre,
    direccion_ferreteria: ferreteria.direccion,
    telefono_ferreteria: ferreteria.telefono_whatsapp,
    logo_url: ferreteria.logo_url,
    numero_orden: orden.numero_orden,
    proveedor: orden.proveedor,
    fecha_emision: orden.created_at,
    estado: orden.estado,
    notas: orden.notas,
    items: orden.items_orden_compra.map((i: any) => ({
      nombre_producto: i.nombre_producto,
      marca: i.marca,
      unidad: i.unidad,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    })),
    costo_total: orden.costo_total,
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(OrdenCompraPDF, { datos }) as any
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(`Error al generar PDF: ${msg}`, { status: 500 })
  }

  return new Response(pdfBuffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${orden.numero_orden}.pdf"`,
    },
  })
}
