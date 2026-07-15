// POST /api/comprobantes/emitir — emite boleta o factura electrónica (SUNAT Directo)
//
// FERRETERÍA AISLADA:
//   - session.ferreteriaId es la única fuente de verdad del tenant
//   - emitirBoleta() / emitirFactura() pasan ferreteriaId a todas las queries internas
//   - El pedido se valida contra ferreteriaId antes de emitir

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { resolverProveedor } from '@/lib/facturacion/resolver'
import { getContextoSucursal } from '@/lib/sucursales/contexto'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: {
    pedido_id?:      string
    tipo?:           'boleta' | 'factura'
    cliente_nombre?: string
    cliente_dni?:    string
    cliente_ruc?:    string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.pedido_id) {
    return NextResponse.json({ error: 'pedido_id es requerido' }, { status: 400 })
  }

  const supabase = await createClient()

  // Resuelve el proveedor de facturación del tenant.
  // El adapter internamente carga credenciales — el endpoint es agnóstico.
  const proveedor = await resolverProveedor(supabase, session.ferreteriaId)

  // Sucursal emisora: la del pedido; si no tiene (legado), la del contexto del usuario.
  // Se resuelve siempre (no solo con multiSucursal) para asignar el local principal
  // en tenants de sucursal única. Nunca se toma del body del cliente.
  let localId: string | null = null
  const { data: ped } = await supabase
    .from('pedidos')
    .select('local_id')
    .eq('id', body.pedido_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()
  localId = ped?.local_id ?? null
  if (!localId) {
    const contexto = await getContextoSucursal(supabase, session)
    localId = contexto.localEscrituraId ?? null
  }

  const tipo = body.tipo ?? 'boleta'

  if (tipo === 'factura') {
    // Validar RUC (11 dígitos)
    const rucLimpio = (body.cliente_ruc ?? '').replace(/\D/g, '')
    if (rucLimpio.length !== 11) {
      return NextResponse.json(
        { error: 'El RUC debe tener 11 dígitos' },
        { status: 400 }
      )
    }
    if (!body.cliente_nombre?.trim()) {
      return NextResponse.json(
        { error: 'La razón social es requerida para facturas' },
        { status: 400 }
      )
    }

    const resultado = await proveedor.emitirFactura({
      supabase,
      pedidoId:      body.pedido_id,
      ferreteriaId:  session.ferreteriaId,  // FERRETERÍA AISLADA — desde la sesión, nunca del body
      clienteNombre: body.cliente_nombre.trim(),
      clienteRuc:    rucLimpio,
      emitidoPor:    'dashboard',
      localId,
    })

    if (!resultado.ok) {
      const status = resultado.tokenInvalido ? 503 : 422
      return NextResponse.json(
        {
          error:          resultado.error,
          tokenInvalido:  resultado.tokenInvalido ?? false,
          comprobanteId:  resultado.comprobanteId ?? null,
        },
        { status }
      )
    }

    return NextResponse.json({
      ok:             true,
      comprobanteId:  resultado.comprobanteId,
      numeroCompleto: resultado.numeroCompleto,
      pdfUrl:         `/api/comprobantes/${resultado.comprobanteId}/pdf`,
      xmlUrl:         resultado.xmlUrl,
      pdfUrlSecundario: resultado.comprobanteSecundarioId ? `/api/comprobantes/${resultado.comprobanteSecundarioId}/pdf` : undefined,
    })
  }

  // tipo === 'boleta' (default)
  const resultado = await proveedor.emitirBoleta({
    supabase,
    pedidoId:      body.pedido_id,
    ferreteriaId:  session.ferreteriaId,  // FERRETERÍA AISLADA — desde la sesión, nunca del body
    clienteNombre: (body.cliente_nombre ?? '').trim() || 'CLIENTE VARIOS',
    clienteDni:    (body.cliente_dni    ?? '').trim(),
    emitidoPor:    'dashboard',
    localId,
  })

  if (!resultado.ok) {
    const status = resultado.tokenInvalido ? 503 : 422
    return NextResponse.json(
      {
        error:          resultado.error,
        tokenInvalido:  resultado.tokenInvalido ?? false,
        comprobanteId:  resultado.comprobanteId ?? null,
      },
      { status }
    )
  }

  return NextResponse.json({
    ok: true,
    comprobanteId: resultado.comprobanteId,
    numeroCompleto: resultado.numeroCompleto,
    pdfUrl: `/api/comprobantes/${resultado.comprobanteId}/pdf`,
    pdfUrlSecundario: resultado.comprobanteSecundarioId ? `/api/comprobantes/${resultado.comprobanteSecundarioId}/pdf` : undefined,
    comprobanteSecundarioId: resultado.comprobanteSecundarioId,
    xmlUrl: resultado.xmlUrl || null
  })
}
