import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generarYEnviarComprobante } from '@/lib/pdf/generar-comprobante'
import { getSessionInfo } from '@/lib/auth/roles'
import { resolverSender } from '@/lib/whatsapp/provider'

// GET /api/orders/[id]/comprobante — obtener comprobante existente
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: pedidoId } = await params
  
  const url = new URL(request.url)
  const tipo = url.searchParams.get('tipo')

  const admin = createAdminClient()
  const { data: comprobantesList, error } = await admin
    .from('comprobantes')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('created_at', { ascending: false })

  const comprobante = tipo 
    ? comprobantesList?.find(c => c.tipo === tipo)
    : comprobantesList?.find(c => c.tipo === 'nota_venta') 

  if (error || !comprobante) {
    return NextResponse.json({ error: 'Sin comprobante' }, { status: 404 })
  }

  return NextResponse.json(comprobante)
}

// POST /api/orders/[id]/comprobante — generar y enviar comprobante
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { id: pedidoId } = await params

  // Resolver proveedor activo (Meta o YCloud) para este tenant
  const adminClient = createAdminClient()
  const { data: ferr } = await adminClient
    .from('ferreterias')
    .select('telefono_whatsapp')
    .eq('id', session.ferreteriaId)
    .single()
  const telefonoFerr = (ferr?.telefono_whatsapp ?? '').replace(/^\+/, '')
  const sender = await resolverSender(adminClient, session.ferreteriaId, telefonoFerr)

  const resultado = await generarYEnviarComprobante({
    pedidoId,
    ferreteriaId: session.ferreteriaId,
    sender: sender ?? undefined,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 500 })
  }

  return NextResponse.json(resultado)
}
