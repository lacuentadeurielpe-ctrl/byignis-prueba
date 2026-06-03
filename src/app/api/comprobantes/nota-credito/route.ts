import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { emitirNotaCredito } from '@/lib/comprobantes/emitir'
import { FacturacionRepository } from '@/lib/db/repositories/facturacion'
import { desencriptar } from '@/lib/encryption'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: {
    comprobanteReferenciaId?: string
    motivoCodigo?: string
    motivoDescripcion?: string
    itemsDevueltos?: { producto_id: string | null; cantidad: number }[]
  }
  
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.comprobanteReferenciaId) {
    return NextResponse.json({ error: 'comprobanteReferenciaId es requerido' }, { status: 400 })
  }

  const supabase = await createClient()
  const facturacionRepo = new FacturacionRepository(supabase)
  
  let config
  try {
    config = await facturacionRepo.obtenerConfiguracionFacturacion(session.ferreteriaId)
  } catch (errConfig) {
    return NextResponse.json({ error: 'Configuración de facturación no encontrada' }, { status: 400 })
  }

  const tokenPlano = config.nubefact_token_enc ? await desencriptar(config.nubefact_token_enc) : ''

  const motivoCodigo = body.motivoCodigo ?? '01' // 01 = Anulación de la operación
  const motivoDescripcion = body.motivoDescripcion ?? 'Anulación de la operación'

  const resultado = await emitirNotaCredito({
    supabase,
    comprobanteReferenciaId: body.comprobanteReferenciaId,
    ferreteriaId:  session.ferreteriaId,
    motivoCodigo,
    motivoDescripcion,
    emitidoPor:    'dashboard',
    itemsDevueltos: body.itemsDevueltos,
    tokenPlano,
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
