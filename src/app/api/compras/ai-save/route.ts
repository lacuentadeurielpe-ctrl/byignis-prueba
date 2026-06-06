import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo } from '@/lib/auth/roles'
import { RepositoryManager } from '@/lib/db'
import { subirImagenComprobante } from '@/lib/storage/supabase-storage'

interface ItemConfirmado {
  descripcion_factura: string // descripción original leída por IA
  accion: 'crear' | 'actualizar'
  producto_existente_id?: string | null
  nombre: string // nombre final elegido por el usuario
  cantidad: number
  precio_compra_unitario: number
  precio_venta_sugerido?: number | null // si es nuevo
  unidad: string
  categoria?: string | null // si es nuevo
  stock_minimo?: number | null // si es nuevo
  es_formal: boolean
}

interface CompraConfirmadaBody {
  tipo: 'formal' | 'informal' | 'mixta'
  numero_factura?: string | null
  fecha_factura?: string | null
  ruc_proveedor?: string | null
  razon_social_proveedor?: string | null
  total_bruto: number
  igv: number
  total_neto: number
  notas?: string | null
  items: ItemConfirmado[]
  recibir_inmediatamente: boolean
  archivos?: { base64: string; mimeType: string }[]
  forzar_duplicado?: boolean
}

// POST /api/compras/ai-save
export async function POST(request: Request) {
  const session = await getSessionInfo()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const db = new RepositoryManager(supabase)

  try {
    const body = await request.json() as CompraConfirmadaBody
    const { items, recibir_inmediatamente, archivos, forzar_duplicado } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No se enviaron ítems para guardar' }, { status: 400 })
    }

    // 0a. Verificar duplicado por número de factura (solo si es formal y tiene número)
    if (!forzar_duplicado && body.numero_factura?.trim()) {
      const { data: existente } = await supabase
        .from('compras')
        .select('id, numero_compra, proveedor_nombre, total_neto, fecha_factura, created_at')
        .eq('ferreteria_id', session.ferreteriaId)
        .eq('numero_factura', body.numero_factura.trim())
        .neq('estado', 'anulada')
        .limit(1)
        .single()

      if (existente) {
        return NextResponse.json({
          error: 'DUPLICADO',
          compra_existente: {
            id: existente.id,
            numero_compra: existente.numero_compra,
            proveedor_nombre: existente.proveedor_nombre,
            total_neto: existente.total_neto,
            fecha_factura: existente.fecha_factura,
            registrado_el: existente.created_at,
          }
        }, { status: 409 })
      }
    }

    // 0b. Subir archivos adjuntos en paralelo si existen
    const urlsArchivos: string[] = []
    if (archivos && archivos.length > 0) {
      const promesasSubida = archivos.map(arch =>
        subirImagenComprobante(arch.base64, arch.mimeType, session.ferreteriaId)
      )
      const resultados = await Promise.allSettled(promesasSubida)
      resultados.forEach(res => {
        if (res.status === 'fulfilled') urlsArchivos.push(res.value)
        else console.error('Falló la subida de un archivo:', res.reason)
      })
    }

    // 1. Resolver Proveedor (Buscar por nombre de razón social)
    let proveedorId: string | null = null
    const provNombre = body.razon_social_proveedor?.trim() || body.ruc_proveedor?.trim()
    if (provNombre) {
      const { data: provs } = await supabase
        .from('proveedores')
        .select('id')
        .eq('ferreteria_id', session.ferreteriaId)
        .eq('nombre', provNombre)
        .limit(1)

      if (provs && provs.length > 0) {
        proveedorId = provs[0].id
      } else {
        // Crear proveedor automáticamente
        const { data: nuevoProv, error: errProv } = await supabase
          .from('proveedores')
          .insert({
            ferreteria_id: session.ferreteriaId,
            nombre: provNombre,
          })
          .select('id')
          .single()

        if (!errProv && nuevoProv) {
          proveedorId = nuevoProv.id
        }
      }
    }

    // 2. Resolver Categorías para productos nuevos
    const nombresCategorias = [
      ...new Set(items.filter((i) => i.accion === 'crear' && i.categoria).map((i) => i.categoria!.trim())),
    ] as string[]
    const mapaCategorias: Record<string, string> = {}

    if (nombresCategorias.length > 0) {
      const { data: existentes } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('ferreteria_id', session.ferreteriaId)
        .in('nombre', nombresCategorias)

      existentes?.forEach((c) => {
        mapaCategorias[c.nombre.toLowerCase()] = c.id
      })

      const nuevas = nombresCategorias.filter((n) => !mapaCategorias[n.toLowerCase()])
      if (nuevas.length > 0) {
        const { data: creadas } = await supabase
          .from('categorias')
          .insert(nuevas.map((nombre) => ({ ferreteria_id: session.ferreteriaId, nombre })))
          .select('id, nombre')

        creadas?.forEach((c) => {
          mapaCategorias[c.nombre.toLowerCase()] = c.id
        })
      }
    }

    // 3. Crear/Actualizar Productos
    const itemsProcesados = []

    for (const item of items) {
      let productoId = item.producto_existente_id || null
      let codigoInterno = null

      if (item.accion === 'crear') {
        // Precio venta sugerido: si no se especifica, agregar un 30% de margen
        const precioBase = item.precio_venta_sugerido ?? Number((item.precio_compra_unitario * 1.3).toFixed(2))

        const { data: prod, error: errProd } = await supabase
          .from('productos')
          .insert({
            ferreteria_id: session.ferreteriaId,
            nombre: item.nombre.trim(),
            categoria_id: item.categoria ? (mapaCategorias[item.categoria.trim().toLowerCase()] ?? null) : null,
            precio_base: precioBase,
            precio_compra: item.precio_compra_unitario,
            unidad: item.unidad || 'NIU',
            stock: 0, // El stock se sumará al procesar la recepción
            stock_minimo: item.stock_minimo ?? null,
            facturable: item.es_formal, // auto-marcar formalidad
            activo: true,
          })
          .select('id, codigo_interno')
          .single()

        if (errProd || !prod) {
          throw new Error(`Error al crear producto "${item.nombre}": ${errProd?.message}`)
        }

        productoId = prod.id
        codigoInterno = prod.codigo_interno
      } else if (item.accion === 'actualizar' && productoId) {
        // Para productos existentes: Actualizar facturable y el costo de compra referencial
        const { data: prod, error: errUpdate } = await supabase
          .from('productos')
          .update({
            facturable: item.es_formal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productoId)
          .eq('ferreteria_id', session.ferreteriaId)
          .select('codigo_interno')
          .single()

        if (errUpdate) {
          console.error(`Error actualizando producto existente ${productoId}:`, errUpdate.message)
        }
        codigoInterno = prod?.codigo_interno || null
      }

      // Guardar alias en alias_productos para memorizar el matching
      if (productoId && item.descripcion_factura) {
        await db.compras.guardarAliasProducto(
          session.ferreteriaId,
          productoId,
          item.descripcion_factura,
          1.0
        )
      }

      // Preparar ítem para la inserción de compra
      itemsProcesados.push({
        productoId,
        nombreProducto: item.nombre.trim(),
        codigoInterno,
        esFormal: item.es_formal,
        tipoItem: 'unitario' as const, // por simplicidad, mapeamos como unitario. Conversión 1:1.
        cantidadComprada: item.cantidad,
        unidadCompra: item.unidad || 'NIU',
        conversionAUnidades: 1,
        precioCompraUnitario: item.precio_compra_unitario,
        subtotal: Number((item.cantidad * item.precio_compra_unitario).toFixed(2)),
        unidadesIngresadasAlStock: item.cantidad, // factor de conversión es 1
      })
    }

    // 4. Registrar la compra con el ComprasRepository
    const compraInput = {
      tipo: body.tipo,
      proveedorId,
      proveedorNombre: provNombre,
      numeroFactura: body.numero_factura || null,
      fechaFactura: body.fecha_factura || null,
      rucProveedor: body.ruc_proveedor || null,
      razonSocialProveedor: body.razon_social_proveedor || null,
      totalBruto: body.total_bruto,
      igv: body.igv,
      totalNeto: body.total_neto,
      estado: (recibir_inmediatamente ? 'recibida' : 'borrador') as 'borrador' | 'recibida',
      notas: body.notas || null,
    }

    const compra = await db.compras.crearCompra(
      session.ferreteriaId,
      compraInput,
      itemsProcesados
    )

    // 5. Vincular archivos adjuntos al registro de compra
    if (urlsArchivos.length > 0) {
      await supabase
        .from('compras')
        .update({ archivos_adjuntos: urlsArchivos })
        .eq('id', (compra as any).id)
    }

    return NextResponse.json({
      success: true,
      compra_id: (compra as any).id,
      numero_compra: (compra as any).numero_compra,
      estado: (compra as any).estado,
    })
  } catch (err: any) {
    console.error('[API Save Compras]', err)
    return NextResponse.json(
      { error: err.message || 'Error al guardar el registro de compra' },
      { status: 500 }
    )
  }
}
