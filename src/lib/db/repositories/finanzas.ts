import type { SupabaseClient } from '@supabase/supabase-js'

export class FinanzasRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Obtiene la lista de rendiciones de repartidores de una ferretería.
   */
  async obtenerRendicionesDashboard(ferreteriaId: string, limite = 60) {
    const { data, error } = await this.supabase
      .from('rendiciones')
      .select('*, repartidores(id, nombre, telefono)')
      .eq('ferreteria_id', ferreteriaId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }

  /**
   * Obtiene los libros contables mensuales generados de la ferretería.
   */
  async obtenerLibrosContablesDashboard(ferreteriaId: string, limite = 24) {
    const { data, error } = await this.supabase
      .from('libros_contables')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .order('periodo', { ascending: false })
      .limit(limite)

    if (error) throw error
    return data ?? []
  }
}
