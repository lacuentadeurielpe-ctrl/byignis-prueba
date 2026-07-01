// Adaptador Nubefact → interfaz ProveedorFacturacion
// Delega a emitir.ts existente (sin tocar la lógica ya probada).

import { desencriptar } from '@/lib/encryption'
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
}
