import type { SupabaseClient } from '@supabase/supabase-js'
import type { Producto, ZonaDelivery, ConfiguracionBot } from '@/types/database'

export class CatalogRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Obtiene la configuración del bot para una ferretería específica.
   */
  async obtenerConfiguracionBot(ferreteriaId: string): Promise<ConfiguracionBot | null> {
    const { data, error } = await this.supabase
      .from('configuracion_bot')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (error) {
      console.error('[CatalogRepository] Error al obtener configuracion_bot:', error.message)
      return null
    }
    return data
  }

  /**
   * Obtiene la lista de productos activos de una ferretería con sus categorías y reglas de descuento.
   */
  async listarProductosActivos(ferreteriaId: string): Promise<Producto[]> {
    const { data, error } = await this.supabase
      .from('productos')
      .select('*, categorias(id,nombre), reglas_descuento(*)')
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)
      .order('nombre')

    if (error) {
      console.error('[CatalogRepository] Error al listar productos activos:', error.message)
      return []
    }
    return data ?? []
  }

  /**
   * Consulta el stock y precio de un producto específico.
   */
  async obtenerProductoConStock(ferreteriaId: string, productoId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('productos')
      .select('id, nombre, unidad, stock, precio_base')
      .eq('id', productoId)
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)
      .single()

    if (error) {
      console.error('[CatalogRepository] Error al obtener stock de producto:', error.message)
      return null
    }
    return data
  }

  /**
   * Obtiene las zonas de delivery activas de una ferretería.
   */
  async listarZonasDeliveryActivas(ferreteriaId: string): Promise<ZonaDelivery[]> {
    const { data, error } = await this.supabase
      .from('zonas_delivery')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)

    if (error) {
      console.error('[CatalogRepository] Error al listar zonas de delivery:', error.message)
      return []
    }
    return data ?? []
  }

  /**
   * Cuenta la cantidad de productos activos de una ferretería.
   */
  async contarProductosActivos(ferreteriaId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('ferreteria_id', ferreteriaId)
      .eq('activo', true)

    if (error) throw error
    return count ?? 0
  }

  async obtenerCategoriasPorNombres(ferreteriaId: string, nombres: string[]) {
    const { data, error } = await this.supabase
      .from('categorias')
      .select('id, nombre')
      .eq('ferreteria_id', ferreteriaId)
      .in('nombre', nombres)

    if (error) throw error
    return data ?? []
  }

  async crearCategorias(ferreteriaId: string, nombres: string[]) {
    const { data, error } = await this.supabase
      .from('categorias')
      .insert(nombres.map((nombre) => ({ ferreteria_id: ferreteriaId, nombre })))
      .select('id, nombre')

    if (error) throw error
    return data ?? []
  }

  async crearProductos(productos: {
    ferreteria_id: string
    nombre: string
    descripcion: string | null
    categoria_id: string | null
    precio_base: number
    unidad: string
    stock: number
    activo: boolean
  }[]) {
    const { data, error } = await this.supabase
      .from('productos')
      .insert(productos)
      .select()

    if (error) throw error
    return data ?? []
  }

  async actualizarProducto(ferreteriaId: string, productoId: string, fields: {
    nombre: string
    descripcion: string | null
    categoria_id: string | null
    precio_base: number
    unidad: string
    stock: number
  }) {
    const { data, error } = await this.supabase
      .from('productos')
      .update(fields)
      .eq('id', productoId)
      .eq('ferreteria_id', ferreteriaId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
