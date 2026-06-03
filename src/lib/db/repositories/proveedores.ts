import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProveedorInput {
  nombre: string
  telefono?: string | null
  contacto?: string | null
}

export interface ItemOrdenCompraInput {
  productoId?: string | null
  nombre: string
  marca?: string | null
  cantidad: number
  precioCompra: number
  unidad?: string
}

export class ProveedorRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Lista todos los proveedores de la ferretería.
   */
  async listarProveedores(ferreteriaId: string) {
    const { data, error } = await this.supabase
      .from('proveedores')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .order('nombre')

    if (error) throw new Error(`Error al listar proveedores: ${error.message}`)
    return data ?? []
  }

  /**
   * Crea un nuevo proveedor.
   */
  async crearProveedor(ferreteriaId: string, input: ProveedorInput) {
    const { data, error } = await this.supabase
      .from('proveedores')
      .insert({
        ferreteria_id: ferreteriaId,
        nombre: input.nombre,
        telefono: input.telefono ?? null,
        contacto: input.contacto ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`Error al crear proveedor: ${error.message}`)
    return data
  }

  /**
   * Genera un correlativo atómico para una nueva orden de compra.
   */
  async generarNumeroOrdenCompra(): Promise<string> {
    const { data, error } = await this.supabase
      .rpc('generar_numero_orden_compra')

    if (error || !data) throw new Error(`Error al generar correlativo de OC: ${error?.message ?? 'sin datos'}`)
    return data as string
  }

  /**
   * Registra una nueva orden de compra (proforma a proveedor).
   */
  async crearOrdenCompra(
    ferreteriaId: string,
    proveedorId: string | null,
    proveedorNombre: string,
    total: number,
    items: ItemOrdenCompraInput[]
  ) {
    // Generar el número correlativo de OC
    const numeroOrden = await this.generarNumeroOrdenCompra()

    // Insertar la cabecera de la orden
    const { data: orden, error: errOrden } = await this.supabase
      .from('ordenes_compra')
      .insert({
        ferreteria_id: ferreteriaId,
        proveedor_id: proveedorId,
        proveedor_nombre: proveedorNombre,
        numero_orden: numeroOrden,
        estado: 'pendiente',
        total,
      })
      .select()
      .single()

    if (errOrden || !orden) throw new Error(`Error al registrar orden de compra: ${errOrden?.message}`)

    const ordenId = (orden as any).id

    // Insertar los ítems asociados
    const { error: errItems } = await this.supabase
      .from('items_orden_compra')
      .insert(
        items.map((i) => ({
          orden_compra_id: ordenId,
          producto_id: i.productoId ?? null,
          nombre: i.nombre,
          marca: i.marca ?? null,
          cantidad: i.cantidad,
          precio_compra: i.precioCompra,
          unidad: i.unidad ?? 'unidad',
        }))
      )

    if (errItems) throw new Error(`Error al registrar ítems de la orden de compra: ${errItems.message}`)

    return {
      id: ordenId,
      numeroOrden,
      total,
    }
  }

  /**
   * Obtiene los detalles de una orden de compra con sus ítems.
   */
  async obtenerOrdenCompra(ferreteriaId: string, ordenId: string) {
    const { data, error } = await this.supabase
      .from('ordenes_compra')
      .select('*, items_orden_compra(*)')
      .eq('id', ordenId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (error) throw new Error(`Error al obtener orden de compra: ${error.message}`)
    return data
  }
}
