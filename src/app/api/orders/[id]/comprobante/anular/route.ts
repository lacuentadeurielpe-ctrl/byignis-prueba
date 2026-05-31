import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { desencriptar } from '@/lib/encryption'
import { enviarANubefact } from '@/lib/nubefact'
import { NubefactAnulacionPayload, NUBEFACT_TIPO } from '@/lib/nubefact/tipos'
import { getSessionInfo } from '@/lib/auth/roles'

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id: pedidoId } = await props.params
    const { motivo } = await request.json()

    if (!motivo) {
      return NextResponse.json({ error: 'Motivo es requerido' }, { status: 400 })
    }

    const session = await getSessionInfo()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const admin = createAdminClient()
    
    // Buscar el comprobante activo del pedido
    const { data: comprobante } = await admin
      .from('comprobantes')
      .select('*, ferreterias:ferreteria_id (nubefact_url, nubefact_token)')
      .eq('pedido_id', pedidoId)
      .eq('estado_sunat', 'ACEPTADO')
      .single()

    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado o no está ACEPTADO en SUNAT' }, { status: 404 })
    }

    if (!comprobante.ferreterias?.nubefact_url || !comprobante.ferreterias?.nubefact_token) {
      return NextResponse.json({ error: 'Configuración de Nubefact incompleta en la ferretería' }, { status: 400 })
    }

    const token = await desencriptar(comprobante.ferreterias.nubefact_token)
    if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    const payload: NubefactAnulacionPayload = {
      operacion: 'generar_anulacion',
      tipo_de_comprobante: comprobante.tipo === 'boleta' ? NUBEFACT_TIPO.BOLETA : NUBEFACT_TIPO.FACTURA,
      serie: comprobante.serie,
      numero: comprobante.numero,
      motivo: motivo,
      codigo_unico: `ANUL-${comprobante.id}`
    }

    const res = await enviarANubefact(comprobante.ferreterias.nubefact_url, token, payload)

    if (res.ok) {
      // Actualizar estado en DB
      await admin.from('comprobantes').update({
        estado_sunat: 'ANULADO'
      }).eq('id', comprobante.id)

      return NextResponse.json({ ok: true, mensaje: 'Comprobante anulado correctamente' })
    } else {
      return NextResponse.json({ error: res.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error anulando:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
