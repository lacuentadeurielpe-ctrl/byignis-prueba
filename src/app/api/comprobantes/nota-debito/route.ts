import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { resolverProveedor } from '@/lib/facturacion/resolver'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: {
    comprobanteReferenciaId?: string
    motivoCodigo?: string
    motivoDescripcion?: string
    montoAjuste?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.comprobanteReferenciaId) {
    return NextResponse.json({ error: 'comprobanteReferenciaId es requerido' }, { status: 400 })
  }
  if (!body.motivoCodigo || !body.motivoDescripcion?.trim()) {
    return NextResponse.json({ error: 'motivoCodigo y motivoDescripcion son requeridos' }, { status: 400 })
  }
  if (!body.montoAjuste || body.montoAjuste <= 0) {
    return NextResponse.json({ error: 'montoAjuste debe ser mayor a 0' }, { status: 400 })
  }

  const supabase = await createClient()

  const proveedor = await resolverProveedor(supabase, session.ferreteriaId)
  const resultado = await proveedor.emitirNotaDebito({
    supabase,
    comprobanteReferenciaId: body.comprobanteReferenciaId,
    ferreteriaId:      session.ferreteriaId,
    motivoCodigo:      body.motivoCodigo,
    motivoDescripcion: body.motivoDescripcion,
    montoAjuste:       body.montoAjuste,
    emitidoPor:        'dashboard',
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
  })
}
