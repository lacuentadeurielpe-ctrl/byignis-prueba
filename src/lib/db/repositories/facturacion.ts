import type { SupabaseClient } from '@supabase/supabase-js'

export interface ComprobanteInput {
  ferreteria_id: string
  pedido_id: string
  tipo: 'boleta' | 'factura' | 'nota_credito' | 'nota_venta'
  serie: string
  numero: number
  numero_completo: string
  numero_comprobante?: string
  estado: string
  subtotal: number
  igv: number
  total: number
  cliente_nombre: string
  cliente_ruc_dni?: string | null
  nubefact_id?: number | null
  nubefact_hash?: string | null
  nubefact_qr_cadena?: string | null
  xml_url?: string | null
  pdf_url?: string | null
  emitido_por: string
  error_envio?: string | null
  comprobante_referencia_id?: string | null
}

export class FacturacionRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Obtiene la configuración de facturación y Nubefact de una ferretería.
   */
  async obtenerConfiguracionFacturacion(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('ferreterias')
      .select('id, ruc, razon_social, nombre_comercial, serie_boletas, serie_facturas, igv_incluido_en_precios, nubefact_token_enc, nubefact_ruta, nubefact_modo, regimen_tributario')
      .eq('id', ferreteriaId)
      .single()

    if (error) throw new Error(`Error al obtener datos de facturación de ferretería: ${error.message}`)
    return data
  }

  /**
   * Busca si ya existe un comprobante emitido exitosamente para un pedido.
   */
  async buscarComprobanteEmitido(ferreteriaId: string, pedidoId: string, tipo: string) {
    const { data } = await this.supabase
      .from('comprobantes')
      .select('id, numero_completo, estado, pdf_url, xml_url')
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .eq('tipo', tipo)
      .eq('estado', 'emitido')
      .maybeSingle()

    return data
  }

  /**
   * Genera correlativo secuencial para comprobantes.
   */
  async generarNumeroComprobante(ferreteriaId: string, tipo: string, serie: string): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('generar_numero_comprobante', {
        p_ferreteria_id: ferreteriaId,
        p_tipo:          tipo,
        p_serie:         serie,
      })

    if (error || data == null) throw new Error(`Error al generar correlativo de comprobante: ${error?.message}`)
    return data as number
  }

  /**
   * Guarda o actualiza el registro local del comprobante.
   */
  async guardarComprobante(input: ComprobanteInput) {
    const { data, error } = await this.supabase
      .from('comprobantes')
      .upsert({
        ferreteria_id:    input.ferreteria_id,
        pedido_id:        input.pedido_id,
        tipo:             input.tipo,
        serie:            input.serie,
        numero:           input.numero,
        numero_completo:  input.numero_completo,
        numero_comprobante: input.numero_comprobante ?? input.numero_completo,
        estado:           input.estado,
        subtotal:         input.subtotal,
        igv:              input.igv,
        total:            input.total,
        cliente_nombre:   input.cliente_nombre,
        cliente_ruc_dni:  input.cliente_ruc_dni ?? null,
        nubefact_id:      input.nubefact_id ?? null,
        nubefact_hash:    input.nubefact_hash ?? null,
        nubefact_qr_cadena: input.nubefact_qr_cadena ?? null,
        xml_url:          input.xml_url ?? null,
        pdf_url:          input.pdf_url ?? null,
        emitido_por:      input.emitido_por,
        error_envio:      input.error_envio ?? null,
        comprobante_referencia_id: input.comprobante_referencia_id ?? null,
      }, {
        onConflict: 'pedido_id,tipo',
      })
      .select('id')
      .single()

    if (error) throw new Error(`Error al guardar comprobante en BD: ${error.message}`)
    return data
  }

  async obtenerDatosFerreteriaDashboard(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('ferreterias')
      .select('id, nubefact_token_enc, tipo_ruc')
      .eq('id', ferreteriaId)
      .single()

    if (error) throw error
    return data
  }

  async obtenerFerreteriaInfo(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('ferreterias')
      .select('id, nombre, telefono_whatsapp, modo_asignacion_delivery')
      .eq('id', ferreteriaId)
      .single()

    if (error) throw error
    return data
  }

  async obtenerFerreteriaComprobanteInfo(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('ferreterias')
      .select('id, nombre, direccion, telefono_whatsapp, formas_pago, logo_url, color_comprobante, mensaje_comprobante')
      .eq('id', ferreteriaId)
      .single()

    if (error) throw error
    return data
  }

  async obtenerComprobantePorPedido(ferreteriaId: string, pedidoId: string, tipo: string) {
    const { data } = await this.supabase
      .from('comprobantes')
      .select('id, numero_comprobante, pdf_url, enviado_whatsapp, estado')
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .eq('tipo', tipo)
      .maybeSingle()
    return data
  }

  async actualizarEnvioComprobante(comprobanteId: string, enviado: boolean, errorEnvio?: string | null) {
    const { data, error } = await this.supabase
      .from('comprobantes')
      .update({
        enviado_whatsapp: enviado,
        enviado_at: enviado ? new Date().toISOString() : null,
        error_envio: errorEnvio ?? null,
      })
      .eq('id', comprobanteId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async eliminarComprobantePorPedido(ferreteriaId: string, pedidoId: string) {
    const { data: comp } = await this.supabase
      .from('comprobantes')
      .select('id, numero_comprobante')
      .eq('pedido_id', pedidoId)
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()

    if (!comp) return null

    // Borrar registro en DB
    const { error } = await this.supabase
      .from('comprobantes')
      .delete()
      .eq('id', comp.id)

    if (error) throw error
    return comp
  }

  /**
   * Obtiene la lista de comprobantes emitidos con relaciones a pedidos e ítems.
   */
  async obtenerComprobantesDashboard(ferreteriaId: string, limite = 200) {
    const { data, error } = await this.supabase
      .from('comprobantes')
      .select('*, pedidos(id, numero_pedido, total, items_pedido(*))')
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }
}
