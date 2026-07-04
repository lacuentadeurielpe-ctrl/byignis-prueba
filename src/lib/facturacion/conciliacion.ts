// Conciliación nocturna (Fase 3 del plan de facturación automática).
//
// El sistema se audita solo cada noche: detecta ventas sin comprobante,
// comprobantes por vencer el plazo legal, certificados por caducar, y
// anulaciones que llevan varios días sin resolverse. Solo se notifica al
// dueño cuando hay algo que requiere su atención — silencio = todo bien.

export interface ExcepcionFiscal {
  tipo:        'venta_sin_comprobante' | 'comprobante_requiere_atencion' | 'certificado_por_vencer' | 'anulacion_atascada'
  mensaje:     string
  referencia?: string   // numero_pedido o numero_completo, para que el dueño ubique el caso
}

export interface ResultadoConciliacion {
  ferreteriaId: string
  excepciones:  ExcepcionFiscal[]
}

const DIAS_ALERTA_CERTIFICADO = 30
const HORAS_VENTANA_VENTAS_SIN_COMPROBANTE = 48   // no reportar pedidos muy viejos (ya se sabría)

export async function detectarExcepciones(supabase: any, ferreteriaId: string): Promise<ResultadoConciliacion> {
  const excepciones: ExcepcionFiscal[] = []

  // 1. Ventas pagadas sin ningún comprobante emitido (boleta/factura), dentro
  //    de una ventana razonable — más viejo que eso ya se habría notado.
  const desde = new Date(Date.now() - HORAS_VENTANA_VENTAS_SIN_COMPROBANTE * 3_600_000).toISOString()
  const { data: pedidosPagados } = await supabase
    .from('pedidos')
    .select('id, numero_pedido')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado_pago', 'pagado')
    .neq('estado', 'cancelado')
    .gte('created_at', desde)

  if (pedidosPagados?.length) {
    const { data: comprobantesDePedidos } = await supabase
      .from('comprobantes')
      .select('pedido_id')
      .eq('ferreteria_id', ferreteriaId)
      .in('pedido_id', pedidosPagados.map((p: any) => p.id))
      .in('tipo', ['boleta', 'factura'])

    const conComprobante = new Set((comprobantesDePedidos ?? []).map((c: any) => c.pedido_id))
    for (const pedido of pedidosPagados) {
      if (!conComprobante.has(pedido.id)) {
        excepciones.push({
          tipo: 'venta_sin_comprobante',
          mensaje: `Pedido ${pedido.numero_pedido} está pagado pero no tiene boleta ni factura`,
          referencia: pedido.numero_pedido,
        })
      }
    }
  }

  // 2. Comprobantes marcados requiere_atencion=true (rechazos definitivos o
  //    reintentos agotados) que aún no fueron resueltos.
  const { data: pendientesAtencion } = await supabase
    .from('comprobantes')
    .select('numero_completo, ultimo_error_sunat')
    .eq('ferreteria_id', ferreteriaId)
    .eq('requiere_atencion', true)
    .in('estado_sunat', ['rechazado', 'error_reintentable'])

  for (const c of pendientesAtencion ?? []) {
    excepciones.push({
      tipo: 'comprobante_requiere_atencion',
      mensaje: `${c.numero_completo ?? 'Comprobante'} necesita revisión: ${c.ultimo_error_sunat ?? 'error sin detalle'}`,
      referencia: c.numero_completo ?? undefined,
    })
  }

  // 3. Certificado digital por vencer
  const { data: creds } = await supabase
    .from('sunat_credenciales')
    .select('cert_vence_at')
    .eq('ferreteria_id', ferreteriaId)
    .eq('estado', 'activo')
    .single()

  if (creds?.cert_vence_at) {
    const diasRestantes = (new Date(creds.cert_vence_at).getTime() - Date.now()) / 86_400_000
    if (diasRestantes <= DIAS_ALERTA_CERTIFICADO) {
      excepciones.push({
        tipo: 'certificado_por_vencer',
        mensaje: diasRestantes <= 0
          ? 'El certificado digital SUNAT YA VENCIÓ — la emisión de comprobantes está bloqueada'
          : `El certificado digital SUNAT vence en ${Math.ceil(diasRestantes)} día(s)`,
      })
    }
  }

  // 4. Anulaciones solicitadas hace más de 3 días sin resolverse (RC/RA que
  //    nunca llegó a procesarse — job caído, credenciales vencidas, etc.)
  const hace3Dias = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const { data: anulacionesAtascadas } = await supabase
    .from('comprobantes')
    .select('numero_completo')
    .eq('ferreteria_id', ferreteriaId)
    .eq('anulacion_solicitada', true)
    .not('estado_sunat', 'in', '(anulado,baja)')
    .lt('anulacion_solicitada_at', hace3Dias)

  for (const c of anulacionesAtascadas ?? []) {
    excepciones.push({
      tipo: 'anulacion_atascada',
      mensaje: `La anulación de ${c.numero_completo ?? 'un comprobante'} lleva más de 3 días sin procesarse`,
      referencia: c.numero_completo ?? undefined,
    })
  }

  return { ferreteriaId, excepciones }
}
