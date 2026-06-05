export interface ItemRaw {
  descripcion: string | null
  cantidad: number | null
  unidad: string | null
  precio_compra_unitario: number | null
  subtotal: number | null
}

export interface CabeceraRaw {
  tipo_documento: string
  total_bruto: number | null
  igv: number | null
  total_neto: number | null
}

export interface ItemNormalizado {
  descripcion_factura: string
  cantidad: number
  unidad_factura: string
  precio_compra_unitario: number
  subtotal: number
}

export interface CabeceraNormalizada {
  tipo_documento: 'factura' | 'boleta' | 'nota_venta' | 'ticket' | 'desconocido'
  es_formal: boolean
  total_bruto: number
  igv: number
  total_neto: number
}

/**
 * Normaliza y recalcula importes y precios de los productos y cabecera del comprobante.
 * Si se detecta que los precios de los ítems fueron extraídos sin IGV (base imponible),
 * se multiplican por 1.18 de manera consistente para registrar el costo neto incluyendo impuestos.
 */
export function reconciliarPreciosEImpuestos(
  cabecera: CabeceraRaw,
  items: ItemRaw[]
): {
  cabecera: CabeceraNormalizada
  items: ItemNormalizado[]
  advertencias: string[]
} {
  const advertencias: string[] = []
  const tipoDoc = (cabecera.tipo_documento || 'factura') as CabeceraNormalizada['tipo_documento']
  const esFormal = ['factura', 'boleta'].includes(tipoDoc)

  // 1. Rellenar campos faltantes por ítem
  const itemsNormalizados: ItemNormalizado[] = items.map((it, idx) => {
    const cantidad = it.cantidad && it.cantidad > 0 ? it.cantidad : 1
    let precio = it.precio_compra_unitario ?? 0
    let subtotal = it.subtotal ?? 0

    if (precio === 0 && subtotal > 0) {
      precio = Number((subtotal / cantidad).toFixed(4))
    } else if (subtotal === 0 && precio > 0) {
      subtotal = Number((cantidad * precio).toFixed(2))
    } else if (precio > 0 && subtotal > 0) {
      const calcSub = Number((cantidad * precio).toFixed(2))
      if (Math.abs(calcSub - subtotal) > 0.05) {
        subtotal = calcSub // forzar que cuadre cantidad * precio = subtotal
      }
    }

    return {
      descripcion_factura: it.descripcion || `Ítem #${idx + 1}`,
      cantidad,
      unidad_factura: it.unidad || 'NIU',
      precio_compra_unitario: precio,
      subtotal
    }
  })

  // 2. Suma de subtotales preliminares
  const sumaSubtotalesPre = itemsNormalizados.reduce((sum, it) => sum + it.subtotal, 0)

  // 3. Determinar importes de cabecera
  const tNeto = cabecera.total_neto ?? sumaSubtotalesPre
  const tBruto = cabecera.total_bruto ?? (tipoDoc === 'factura' ? tNeto / 1.18 : tNeto)
  const tIgv = cabecera.igv ?? (tipoDoc === 'factura' ? tNeto - tBruto : 0)

  const cabeceraNorm: CabeceraNormalizada = {
    tipo_documento: tipoDoc,
    es_formal: esFormal,
    total_bruto: Number(tBruto.toFixed(2)),
    igv: Number(tIgv.toFixed(2)),
    total_neto: Number(tNeto.toFixed(2))
  }

  // 4. Detección y corrección de Precios sin IGV
  // Si la suma de subtotales es igual o muy cercana al subtotal/base imponible (total_bruto) del documento
  // y diferente del total neto, significa que los precios unitarios fueron listados ex-IGV.
  if (
    tipoDoc === 'factura' &&
    cabeceraNorm.total_bruto > 0 &&
    Math.abs(sumaSubtotalesPre - cabeceraNorm.total_bruto) < 0.10 &&
    Math.abs(sumaSubtotalesPre - cabeceraNorm.total_neto) > 0.50
  ) {
    itemsNormalizados.forEach((it) => {
      it.precio_compra_unitario = Number((it.precio_compra_unitario * 1.18).toFixed(4))
      it.subtotal = Number((it.cantidad * it.precio_compra_unitario).toFixed(2))
    })
    advertencias.push(
      'Se detectó que los precios unitarios de la factura fueron grabados sin IGV. Se han multiplicado automáticamente por 1.18 para registrar el costo neto incluyendo impuestos.'
    )
  }

  // 5. Alertas finales de consistencia
  const sinPrecio = itemsNormalizados.filter((it) => it.precio_compra_unitario === 0).length
  if (sinPrecio > 0) {
    advertencias.push(`Se detectaron ${sinPrecio} ítems con precio de compra cero. Deberás completarlos manualmente.`)
  }

  const sumaSubtotalesFinal = itemsNormalizados.reduce((sum, it) => sum + it.subtotal, 0)
  if (Math.abs(sumaSubtotalesFinal - cabeceraNorm.total_neto) > 0.50) {
    advertencias.push(
      `Discrepancia en importes: El total extraído de cabecera es S/. ${cabeceraNorm.total_neto.toFixed(2)}, pero la suma de los ítems es S/. ${sumaSubtotalesFinal.toFixed(2)}.`
    )
  }

  return {
    cabecera: cabeceraNorm,
    items: itemsNormalizados,
    advertencias
  }
}
