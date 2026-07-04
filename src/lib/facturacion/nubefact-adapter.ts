// Adaptador Nubefact → interfaz ProveedorFacturacion
// Delega a emitir.ts existente (sin tocar la lógica ya probada).

import { desencriptar } from '@/lib/encryption'
import { enviarANubefact } from '@/lib/nubefact'
import { NUBEFACT_TIPO, type NubefactAnulacionPayload } from '@/lib/nubefact/tipos'
import {
  emitirBoleta   as _emitirBoleta,
  emitirFactura  as _emitirFactura,
  emitirNotaCredito as _emitirNotaCredito,
} from '@/lib/comprobantes/emitir'
import type {
  ProveedorFacturacion,
  OpcionesEmisionBoleta,
  OpcionesEmisionFactura,
  OpcionesNotaCredito,
  OpcionesSolicitarAnulacion,
  ResultadoAnulacion,
  ResultadoEmisionUnificado,
} from './types'

export class NubefactAdapter implements ProveedorFacturacion {
  nombre = 'nubefact' as const

  private async resolverToken(supabase: any, ferreteriaId: string): Promise<string | null> {
    const { data } = await supabase
      .from('ferreterias')
      .select('nubefact_token_enc')
      .eq('id', ferreteriaId)
      .single()

    if (!data?.nubefact_token_enc) return null
    try {
      return await desencriptar(data.nubefact_token_enc)
    } catch {
      return null
    }
  }

  async emitirBoleta(opts: OpcionesEmisionBoleta): Promise<ResultadoEmisionUnificado> {
    const token = await this.resolverToken(opts.supabase, opts.ferreteriaId)
    if (!token) return { ok: false, error: 'Nubefact no configurado. Ve a Settings → Integraciones → Nubefact.', tokenInvalido: true }
    return _emitirBoleta({ ...opts, tipoBoleta: 'boleta', tokenPlano: token })
  }

  async emitirFactura(opts: OpcionesEmisionFactura): Promise<ResultadoEmisionUnificado> {
    const token = await this.resolverToken(opts.supabase, opts.ferreteriaId)
    if (!token) return { ok: false, error: 'Nubefact no configurado. Ve a Settings → Integraciones → Nubefact.', tokenInvalido: true }
    return _emitirFactura({ ...opts, tokenPlano: token })
  }

  async emitirNotaCredito(opts: OpcionesNotaCredito): Promise<ResultadoEmisionUnificado> {
    const token = await this.resolverToken(opts.supabase, opts.ferreteriaId)
    if (!token) return { ok: false, error: 'Nubefact no configurado.', tokenInvalido: true }
    return _emitirNotaCredito({ ...opts, tokenPlano: token })
  }

  // Nubefact resuelve la emisión de forma síncrona (no requiere cola de reintentos
  // propia — cualquier fallo de red ya se refleja de inmediato en emitirBoleta/Factura),
  // así que no implementa `reintentarEnvio` (es opcional en la interfaz).

  // Nubefact anula de forma SÍNCRONA (tiene su propio endpoint de anulación) — a
  // diferencia de SUNAT Directo, aquí no hace falta esperar al job nocturno.
  async solicitarAnulacion(opts: OpcionesSolicitarAnulacion): Promise<ResultadoAnulacion> {
    const { data: comp } = await opts.supabase
      .from('comprobantes')
      .select('id, tipo, serie, numero, estado, estado_sunat')
      .eq('id', opts.comprobanteId)
      .eq('ferreteria_id', opts.ferreteriaId)
      .single()

    if (!comp) return { ok: false, error: 'Comprobante no encontrado' }
    if (comp.tipo !== 'boleta' && comp.tipo !== 'factura') {
      return { ok: false, error: 'Este tipo de documento no se anula por esta vía' }
    }
    if (comp.estado !== 'emitido') {
      return { ok: false, error: 'Solo se pueden anular comprobantes emitidos' }
    }

    const { data: ferreteria } = await opts.supabase
      .from('ferreterias')
      .select('nubefact_ruta')
      .eq('id', opts.ferreteriaId)
      .single()

    const token = await this.resolverToken(opts.supabase, opts.ferreteriaId)
    if (!token || !ferreteria?.nubefact_ruta) {
      return { ok: false, error: 'Nubefact no configurado. Ve a Configuración → Integraciones → Nubefact.' }
    }

    const payload: NubefactAnulacionPayload = {
      operacion:           'generar_anulacion',
      tipo_de_comprobante: comp.tipo === 'boleta' ? NUBEFACT_TIPO.BOLETA : NUBEFACT_TIPO.FACTURA,
      serie:               comp.serie,
      numero:              comp.numero,
      motivo:              opts.motivo,
      codigo_unico:        `ANUL-${comp.id}`,
    }

    const res = await enviarANubefact(ferreteria.nubefact_ruta, token, payload)
    if (!res.ok) return { ok: false, error: res.error ?? 'Error al anular en Nubefact' }

    await opts.supabase.from('comprobantes').update({
      estado:                   'anulado',
      estado_sunat:              'anulado',
      anulacion_solicitada:      true,
      anulacion_motivo:          opts.motivo,
      anulacion_solicitada_at:   new Date().toISOString(),
      anulacion_solicitada_por:  opts.usuario,
    }).eq('id', comp.id)

    return { ok: true }
  }
}
