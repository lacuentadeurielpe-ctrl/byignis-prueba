import type { SupabaseClient } from '@supabase/supabase-js'

export interface ItemCompraInput {
  productoId: string | null
  nombreProducto: string
  codigoInterno?: string | null
  esFormal: boolean
  tipoItem: 'unitario' | 'paquete_a_unidades' | 'lote'
  cantidadComprada: number
  unidadCompra: string
  conversionAUnidades?: number
  precioCompraUnitario: number
  subtotal: number
  unidadesIngresadasAlStock: number
}

export interface CompraInput {
  tipo: 'formal' | 'informal' | 'mixta'
  proveedorId?: string | null
  proveedorNombre?: string | null
  numeroFactura?: string | null
  fechaFactura?: string | null
  rucProveedor?: string | null
  razonSocialProveedor?: string | null
  totalBruto: number
  igv: number
  totalNeto: number
  estado?: 'borrador' | 'recibida' | 'anulada'
  notas?: string | null
}

export class ComprasRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Crea un nuevo registro de compra con sus respectivos ítems.
   */
  async crearCompra(ferreteriaId: string, input: CompraInput, items: ItemCompraInput[]) {
    // 1. Insertar cabecera de la compra
    const { data: compra, error: errCompra } = await this.supabase
      .from('compras')
      .insert({
        ferreteria_id: ferreteriaId,
        tipo: input.tipo,
        proveedor_id: input.proveedorId ?? null,
        proveedor_nombre: input.proveedorNombre ?? null,
        numero_factura: input.numeroFactura ?? null,
        fecha_factura: input.fechaFactura ?? null,
        ruc_proveedor: input.rucProveedor ?? null,
        razon_social_proveedor: input.razonSocialProveedor ?? null,
        total_bruto: input.totalBruto,
        igv: input.igv,
        total_neto: input.totalNeto,
        estado: input.estado ?? 'borrador',
        notas: input.notas ?? null,
      })
      .select()
      .single()

    if (errCompra || !compra) {
      console.error('[ComprasRepository] Error al crear compra:', errCompra?.message)
      throw new Error(`Error al registrar compra: ${errCompra?.message}`)
    }

    const compraId = (compra as any).id

    // 2. Insertar ítems de la compra
    const { error: errItems } = await this.supabase.from('items_compra').insert(
      items.map((i) => ({
        compra_id: compraId,
        producto_id: i.productoId,
        nombre_producto: i.nombreProducto,
        codigo_interno: i.codigoInterno ?? null,
        es_formal: i.esFormal,
        tipo_item: i.tipoItem,
        cantidad_comprada: i.cantidadComprada,
        unidad_compra: i.unidadCompra,
        conversion_a_unidades: i.conversionAUnidades ?? 1,
        precio_compra_unitario: i.precioCompraUnitario,
        subtotal: i.subtotal,
        unidades_ingresadas_al_stock: i.unidadesIngresadasAlStock,
      }))
    )

    if (errItems) {
      console.error('[ComprasRepository] Error al insertar items_compra:', errItems.message)
      // Si falla, intentamos borrar la cabecera para no dejar registros huérfanos
      await this.supabase.from('compras').delete().eq('id', compraId)
      throw new Error(`Error al registrar ítems de compra: ${errItems.message}`)
    }

    // 3. Si se especificó estado 'recibida', confirmar la recepción atómicamente
    if (input.estado === 'recibida') {
      try {
        await this.confirmarRecepcion(ferreteriaId, compraId)
      } catch (confirmErr: any) {
        // Si falla la confirmación, borramos la compra para consistencia
        await this.supabase.from('compras').delete().eq('id', compraId)
        throw confirmErr
      }
    }

    return compra
  }

  /**
   * Obtiene la lista de compras del local con filtros opcionales.
   */
  async listarCompras(
    ferreteriaId: string,
    filtros?: { estado?: string; tipo?: string; query?: string }
  ) {
    let q = this.supabase
      .from('compras')
      .select('*')
      .eq('ferreteria_id', ferreteriaId)
      .order('created_at', { ascending: false })

    if (filtros?.estado) {
      q = q.eq('estado', filtros.estado)
    }
    if (filtros?.tipo) {
      q = q.eq('tipo', filtros.tipo)
    }

    const { data, error } = await q

    if (error) {
      console.error('[ComprasRepository] Error al listar compras:', error.message)
      return []
    }

    // Si hay búsqueda por texto libre (ej: número de factura, correlativo, proveedor)
    if (filtros?.query) {
      const match = filtros.query.toLowerCase().trim()
      return (data ?? []).filter(
        (c: any) =>
          c.numero_compra?.toLowerCase().includes(match) ||
          c.numero_factura?.toLowerCase().includes(match) ||
          c.proveedor_nombre?.toLowerCase().includes(match) ||
          c.ruc_proveedor?.includes(match)
      )
    }

    return data ?? []
  }

  /**
   * Obtiene una compra y todos sus ítems asociados.
   */
  async obtenerCompraPorId(ferreteriaId: string, compraId: string) {
    const { data, error } = await this.supabase
      .from('compras')
      .select('*, items_compra(*)')
      .eq('id', compraId)
      .eq('ferreteria_id', ferreteriaId)
      .single()

    if (error) {
      console.error('[ComprasRepository] Error al obtener compra:', error.message)
      return null
    }

    return data
  }

  /**
   * Llama a la función RPC para confirmar la recepción e incrementar stock.
   */
  async confirmarRecepcion(ferreteriaId: string, compraId: string) {
    const { data, error } = await this.supabase.rpc('confirmar_recepcion_compra', {
      p_ferreteria_id: ferreteriaId,
      p_compra_id: compraId,
    })

    if (error) {
      console.error('[ComprasRepository] Error al confirmar recepcion:', error.message)
      throw new Error(`Error al confirmar recepción: ${error.message}`)
    }

    return data
  }

  /**
   * Llama a la función RPC para anular la recepción y revertir stock.
   */
  async anularCompra(ferreteriaId: string, compraId: string) {
    const { data, error } = await this.supabase.rpc('anular_recepcion_compra', {
      p_ferreteria_id: ferreteriaId,
      p_compra_id: compraId,
    })

    if (error) {
      console.error('[ComprasRepository] Error al anular compra:', error.message)
      throw new Error(`Error al anular compra: ${error.message}`)
    }

    return data
  }

  /**
   * Busca un producto_id en base a un alias registrado para la ferretería.
   */
  async obtenerProductoIdPorAlias(ferreteriaId: string, alias: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('alias_productos')
      .select('producto_id')
      .eq('ferreteria_id', ferreteriaId)
      .eq('alias', alias.trim())
      .maybeSingle()

    if (error) {
      console.error('[ComprasRepository] Error al obtener producto por alias:', error.message)
      return null
    }

    return data?.producto_id ?? null
  }

  /**
   * Registra o actualiza la relación alias -> producto.
   */
  async guardarAliasProducto(
    ferreteriaId: string,
    productoId: string,
    alias: string,
    confianza = 1.0
  ): Promise<void> {
    const aliasNormalizado = alias.trim()
    if (!aliasNormalizado) return

    const { error } = await this.supabase
      .from('alias_productos')
      .upsert({
        ferreteria_id: ferreteriaId,
        producto_id: productoId,
        alias: aliasNormalizado,
        confianza,
      }, {
        onConflict: 'ferreteria_id,alias'
      })

    if (error) {
      console.error('[ComprasRepository] Error al guardar alias de producto:', error.message)
    }
  }

  /**
   * Obtiene todos los alias registrados para una ferretería.
   */
  async listarAliasProductos(ferreteriaId: string): Promise<{ alias: string; producto_id: string }[]> {
    const { data, error } = await this.supabase
      .from('alias_productos')
      .select('alias, producto_id')
      .eq('ferreteria_id', ferreteriaId)

    if (error) {
      console.error('[ComprasRepository] Error al listar alias de productos:', error.message)
      return []
    }

    return data ?? []
  }
}
