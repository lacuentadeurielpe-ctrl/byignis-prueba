import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { desencriptar } from '@/lib/encryption'
import { enviarANubefact } from '@/lib/nubefact'
import { NubefactConsultarPayload, NUBEFACT_TIPO } from '@/lib/nubefact/tipos'
import { getSessionInfo } from '@/lib/auth/roles'

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id: pedidoId } = await props.params

    const session = await getSessionInfo()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const admin = createAdminClient()
    
    // Buscar el comprobante activo del pedido
    const { data: comprobante } = await admin
      .from('comprobantes')
      .select('*, ferreterias:ferreteria_id (nubefact_url, nubefact_token)')
      .eq('pedido_id', pedidoId)
      .single()

    if (!comprobante || !comprobante.serie) {
      return NextResponse.json({ error: 'Comprobante válido no encontrado' }, { status: 404 })
    }

    if (!comprobante.ferreterias?.nubefact_url || !comprobante.ferreterias?.nubefact_token) {
      return NextResponse.json({ error: 'Configuración de Nubefact incompleta en la ferretería' }, { status: 400 })
    }

    const token = await desencriptar(comprobante.ferreterias.nubefact_token)
    if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    const payload: NubefactConsultarPayload = {
      operacion: 'consultar_comprobante',
      tipo_de_comprobante: comprobante.tipo === 'boleta' ? NUBEFACT_TIPO.BOLETA : comprobante.tipo === 'factura' ? NUBEFACT_TIPO.FACTURA : NUBEFACT_TIPO.NOTA_DE_CREDITO,
      serie: comprobante.serie,
      numero: comprobante.numero,
    }

    const res = await enviarANubefact(comprobante.ferreterias.nubefact_url, token, payload)

    if (res.ok && res.data) {
      // Actualizar estado en DB si hubo cambios (por ejemplo si ya fue aceptada por SUNAT)
      await admin.from('comprobantes').update({
        estado_sunat: res.data.aceptada_por_sunat ? 'ACEPTADO' : 'ENVIADO',
        pdf_url: res.data.enlace_del_pdf || comprobante.pdf_url,
        xml_url: res.data.enlace_del_xml || comprobante.xml_url,
        nubefact_qr_cadena: res.data.cadena_para_codigo_qr || comprobante.nubefact_qr_cadena,
      }).eq('id', comprobante.id)

      return NextResponse.json({ ok: true, mensaje: 'Estado sincronizado con SUNAT', datos: res.data })
    } else {
      return NextResponse.json({ error: res.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error consultando:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
