import { NextResponse } from 'next/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { procesarComprobanteUniversal } from '@/lib/ai/extractor/core'

export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { imagenes, timezoneOffset } = body as {
      imagenes?: { base64: string; mimeType: string }[]
      timezoneOffset?: number
    }

    if (!imagenes || imagenes.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos una imagen' }, { status: 400 })
    }

    // Delegar al motor centralizado
    const respuesta = await procesarComprobanteUniversal(imagenes, {
      ferreteriaId: session.ferreteriaId,
      timezoneOffset
    })

    return NextResponse.json(respuesta)
  } catch (err: any) {
    console.error('[API AI-Extract Compras]', err)
    return NextResponse.json(
      { error: err.message || 'Error al procesar el comprobante' },
      { status: 500 }
    )
  }
}
