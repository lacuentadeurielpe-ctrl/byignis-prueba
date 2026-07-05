// POST /api/comprobantes/[id]/anular — solicitar anulación de un comprobante
//
// Provider-agnóstico: resuelve el adapter activo del negocio y delega. SUNAT
// Directo solo marca la solicitud — el envío real del RC de baja / Comunicación
// de Baja lo procesa el job nocturno `facturacion-anulaciones`.

import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { resolverProveedor } from '@/lib/facturacion/resolver'

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: comprobanteId } = await props.params

  let body: { motivo?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const motivo = (body.motivo ?? '').trim()
  if (!motivo) return NextResponse.json({ error: 'El motivo es requerido' }, { status: 400 })

  const supabase = await createClient()
  const proveedor = await resolverProveedor(supabase, session.ferreteriaId)

  const resultado = await proveedor.solicitarAnulacion({
    supabase,
    comprobanteId,
    ferreteriaId: session.ferreteriaId,
    motivo,
    usuario: session.userId,
  })

  if (!resultado.ok) return NextResponse.json({ error: resultado.error ?? 'Error al solicitar la anulación' }, { status: 422 })

  return NextResponse.json({ ok: true })
}
