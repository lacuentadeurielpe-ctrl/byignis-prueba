// POST /api/comprobantes/[id]/reemitir — re-emite una boleta/factura que quedó
// en error o rechazada definitivamente por SUNAT.
//
// A diferencia de reintentarEnvio() (job automático, reutiliza el MISMO número
// para fallas transitorias `error_reintentable`), este endpoint vuelve a pasar
// por el flujo de emisión completo: reserva un correlativo NUEVO y hace upsert
// sobre la fila fallida (onConflict pedido_id,tipo). Es la vía correcta para
// rechazos definitivos: el número anterior (si llegó a asignarse) queda quemado
// y jamás se reutiliza — evita el error SUNAT 1033.
//
// FERRETERÍA AISLADA: el comprobante se valida contra session.ferreteriaId.

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { resolverProveedor } from '@/lib/facturacion/resolver'

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: comprobanteId } = await props.params

  const supabase = await createClient()

  const { data: comp } = await supabase
    .from('comprobantes')
    .select('id, tipo, estado, estado_sunat, pedido_id, cliente_nombre, cliente_ruc_dni, local_id')
    .eq('id', comprobanteId)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()

  if (!comp) {
    return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
  }
  if (comp.tipo !== 'boleta' && comp.tipo !== 'factura') {
    return NextResponse.json(
      { error: `Re-emisión no soportada para tipo "${comp.tipo}"` },
      { status: 400 }
    )
  }
  // Solo comprobantes fallidos: error local o rechazo definitivo de SUNAT.
  // Los `error_reintentable` los maneja el job automático (mismo número);
  // los aceptados/anulados no se tocan.
  const esFallido =
    comp.estado === 'error' || comp.estado_sunat === 'rechazado'
  if (!esFallido || comp.estado === 'anulado' || comp.estado_sunat === 'aceptado' || comp.estado_sunat === 'aceptado_obs') {
    return NextResponse.json(
      { error: 'Solo se pueden re-emitir comprobantes en estado de error o rechazados por SUNAT' },
      { status: 400 }
    )
  }
  if (comp.estado_sunat === 'error_reintentable') {
    return NextResponse.json(
      { error: 'Este comprobante está en cola de reintento automático — espera unos minutos' },
      { status: 400 }
    )
  }
  if (!comp.pedido_id) {
    return NextResponse.json(
      { error: 'Comprobante sin pedido asociado — no se puede re-emitir' },
      { status: 400 }
    )
  }

  const proveedor = await resolverProveedor(supabase, session.ferreteriaId)

  // Sucursal emisora: la del pedido (fuente de verdad, igual que en /emitir);
  // si no tiene, la que guardó el intento original. resolverSerie() usará la
  // serie propia de esa sucursal (o la del tenant si no tiene serie propia).
  const { data: ped } = await supabase
    .from('pedidos')
    .select('local_id')
    .eq('id', comp.pedido_id)
    .eq('ferreteria_id', session.ferreteriaId)
    .single()
  const localId: string | null = ped?.local_id ?? comp.local_id ?? null

  // Cliente: se conservan los datos del intento original.
  const clienteNombre = (comp.cliente_nombre ?? '').trim()
  const clienteDoc    = (comp.cliente_ruc_dni ?? '').replace(/\D/g, '')

  const resultado = comp.tipo === 'factura'
    ? await proveedor.emitirFactura({
        supabase,
        pedidoId:      comp.pedido_id,
        ferreteriaId:  session.ferreteriaId,
        clienteNombre: clienteNombre || 'CLIENTES VARIOS',
        clienteRuc:    clienteDoc,
        emitidoPor:    'dashboard',
        localId,
      })
    : await proveedor.emitirBoleta({
        supabase,
        pedidoId:      comp.pedido_id,
        ferreteriaId:  session.ferreteriaId,
        clienteNombre: clienteNombre || 'CLIENTE VARIOS',
        clienteDni:    clienteDoc,
        emitidoPor:    'dashboard',
        localId,
      })

  if (!resultado.ok) {
    const status = resultado.tokenInvalido ? 503 : 422
    return NextResponse.json(
      {
        error:         resultado.error,
        tokenInvalido: resultado.tokenInvalido ?? false,
        comprobanteId: resultado.comprobanteId ?? null,
      },
      { status }
    )
  }

  return NextResponse.json({
    ok:             true,
    comprobanteId:  resultado.comprobanteId,
    numeroCompleto: resultado.numeroCompleto,
    pdfUrl:         `/api/comprobantes/${resultado.comprobanteId}/pdf`,
    xmlUrl:         resultado.xmlUrl ?? null,
  })
}
