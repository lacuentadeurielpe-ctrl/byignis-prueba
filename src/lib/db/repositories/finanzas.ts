import type { SupabaseClient } from '@supabase/supabase-js'

export class FinanzasRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Obtiene la lista de rendiciones de repartidores de una ferretería.
   * Nota: rendiciones.repartidor_id apunta a la tabla legacy repartidores_backup_deprecated.
   * Como los repartidores fueron unificados en miembros_ferreteria (migración 112),
   * resolvemos los nombres en un segundo query y los combinamos en memoria.
   */
  async obtenerRendicionesDashboard(ferreteriaId: string, limite = 60) {
    const { data: rendiciones, error } = await this.supabase
      .from('rendiciones')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limite)

    if (error) throw error
    if (!rendiciones || rendiciones.length === 0) return []

    // Obtener nombres de repartidores desde miembros_ferreteria (tabla unificada)
    const { data: miembros } = await this.supabase
      .from('miembros_ferreteria')
      .select('id, nombre, telefono')
      .eq('ferreteria_id', ferreteriaId)
      .eq('rol', 'repartidor')

    const miembrosMap = new Map((miembros ?? []).map(m => [m.id, m]))

    // Combinar en memoria respetando la interfaz que espera RendicionesView
    return rendiciones.map(r => ({
      ...r,
      repartidores: miembrosMap.get(r.repartidor_id) ?? null,
    }))
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
