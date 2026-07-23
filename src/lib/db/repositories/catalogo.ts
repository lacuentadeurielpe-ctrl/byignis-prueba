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
   * Obtiene la lista de productos activos de una ferretería con sus categorías, reglas de descuento, variantes y atributos.
   */
  async listarProductosActivos(ferreteriaId: string): Promise<Producto[]> {
    const { data, error } = await this.supabase
      .from('productos')
      .select('*, categorias(id,nombre), reglas_descuento(*), variantes_producto(*), producto_atributos(*, valores:atributo_valores(*))')
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
      .select('id, nombre, unidad, stock, precio_base, codigo_interno, tiene_variantes, variantes_producto(*)')
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
   * Obtiene la lista de variantes de un producto.
   */
  async listarVariantesDeProducto(ferreteriaId: string, productoId: string) {
    const { data, error } = await this.supabase
      .from('variantes_producto')
      .select('*')
      .eq('producto_id', productoId)
      .eq('ferreteria_id', ferreteriaId)
      .order('nombre_variante')

    if (error) {
      console.error('[CatalogRepository] Error al listar variantes:', error.message)
      return []
    }
    return data ?? []
  }

  /**
   * Crea una nueva variante para un producto.
   */
  async crearVariante(ferreteriaId: string, variante: {
    producto_id: string
    nombre_variante: string
    sku?: string | null
    precio?: number | null
    precio_compra?: number | null
    stock?: number
    stock_minimo?: number
    imagen_url?: string | null
    activo?: boolean
    venta_sin_stock?: boolean
    valores_ids: string[]
  }) {
    const { data, error } = await this.supabase
      .from('variantes_producto')
      .insert({ ...variante, ferreteria_id: ferreteriaId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Actualiza una variante existente.
   */
  async actualizarVariante(ferreteriaId: string, varianteId: string, fields: Record<string, any>) {
    const { data, error } = await this.supabase
      .from('variantes_producto')
      .update(fields)
      .eq('id', varianteId)
      .eq('ferreteria_id', ferreteriaId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Elimina una variante.
   */
  async eliminarVariante(ferreteriaId: string, varianteId: string) {
    const { error } = await this.supabase
      .from('variantes_producto')
      .delete()
      .eq('id', varianteId)
      .eq('ferreteria_id', ferreteriaId)

    if (error) throw error
    return true
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
    tiene_variantes?: boolean
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
    tiene_variantes?: boolean
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

  /**
   * Obtiene un producto por su código interno y ferretería.
   */
  async obtenerProductoPorCodigo(ferreteriaId: string, codigoInterno: string): Promise<Producto | null> {
    const { data, error } = await this.supabase
      .from('productos')
      .select('*, categorias(id,nombre), reglas_descuento(*), variantes_producto(*), producto_atributos(*, valores:atributo_valores(*))')
      .eq('ferreteria_id', ferreteriaId)
      .eq('codigo_interno', codigoInterno)
      .eq('activo', true)
      .maybeSingle()

    if (error) {
      console.error('[CatalogRepository] Error al obtener producto por codigo_interno:', error.message)
      return null
    }
    return data
  }
}
