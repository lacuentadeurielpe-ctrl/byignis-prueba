import type { SupabaseClient } from '@supabase/supabase-js'

export interface MovimientoCreditoInput {
  ferreteriaId: string
  tipoTarea: string
  conversacionId: string
  origen: 'bot' | 'dashboard'
}

export class SuscripcionRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Verifica si una ferretería cuenta con saldo suficiente de créditos de IA.
   */
  async verificarSaldoCreditos(ferreteriaId: string, creditosRequeridos: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('creditos')
      .select('saldo')
      .eq('ferreteria_id', ferreteriaId)
      .maybeSingle()

    if (error) {
      console.error('[SuscripcionRepository] Error al consultar saldo:', error.message)
      return false
    }
    return (data?.saldo ?? 0) >= creditosRequeridos
  }

  /**
   * Descuenta créditos de la cuenta del local tras un consumo de IA.
   */
  async descontarCreditos(ferreteriaId: string, creditosAConsumir: number): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await this.supabase
      .rpc('descontar_creditos_ferreteria', {
        p_ferreteria_id: ferreteriaId,
        p_cantidad:      creditosAConsumir,
      })

    if (error) {
      return { ok: false, error: error.message }
    }
    return { ok: data as boolean }
  }

  /**
   * Registra la auditoría de un consumo de créditos en el historial de movimientos.
   */
  async registrarMovimientoCreditos(input: MovimientoCreditoInput): Promise<void> {
    const { error } = await this.supabase
      .from('movimientos_creditos')
      .insert({
        ferreteria_id:   input.ferreteriaId,
        tipo_tarea:      input.tipoTarea,
        conversacion_id: input.conversacionId,
        origen:          input.origen,
      })

    if (error) {
      console.error('[SuscripcionRepository] Error al registrar movimiento de creditos:', error.message)
    }
  }
}
