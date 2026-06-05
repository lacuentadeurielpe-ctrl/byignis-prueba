export interface ItemRaw {
  descripcion: string | null
  cantidad: number | null
  unidad: string | null
  valor_unitario?: number | null
  precio_unitario?: number | null
  subtotal_linea?: number | null
  total_linea?: number | null
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
 * Emplea un sistema de validación cruzada y cascada de prioridades para resolver columnas
 * faltantes, detectar confusión entre totales y precios unitarios, y normalizar impuestos (IGV).
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

  // 1. Cabecera inicializada
  const tNeto = cabecera.total_neto ?? 0
  const tBruto = cabecera.total_bruto ?? (tipoDoc === 'factura' && tNeto > 0 ? tNeto / 1.18 : tNeto)
  const tIgv = cabecera.igv ?? (tipoDoc === 'factura' && tNeto > 0 ? tNeto - tBruto : 0)

  const cabeceraNorm: CabeceraNormalizada = {
    tipo_documento: tipoDoc,
    es_formal: esFormal,
    total_bruto: Number(tBruto.toFixed(2)),
    igv: Number(tIgv.toFixed(2)),
    total_neto: Number(tNeto.toFixed(2))
  }

  // 2. Procesar ítems e intentar resolver confusión de columnas unitario vs total
  const itemsProcesados = items.map((it, idx) => {
    const cantidad = it.cantidad && it.cantidad > 0 ? it.cantidad : 1
    
    // Extraer valores o usar fallback heredado
    let valUnit = it.valor_unitario ?? null
    let preUnit = it.precio_unitario ?? null
    let subLine = it.subtotal_linea ?? null
    let totLine = it.total_linea ?? null
    
    let legacyPrice = it.precio_compra_unitario ?? null
    let legacySubtotal = it.subtotal ?? null

    // Corrección de confusión de columna unitario vs total
    // Si la cantidad es > 1 y el precio unitario extraído es idéntico al total de la línea (o subtotal de línea)
    // significa que la IA extrajo el total del renglón en lugar del precio de una sola unidad.
    if (cantidad > 1) {
      // Caso 1: precio_unitario coincide con total_linea
      if (preUnit !== null && totLine !== null && Math.abs(preUnit - totLine) < 0.05) {
        preUnit = Number((totLine / cantidad).toFixed(4))
        advertencias.push(`Ítem #${idx + 1}: Se detectó que el precio unitario extraído coincidía con el total de la fila. Se corrigió dividiendo entre la cantidad (${cantidad}).`)
      }
      // Caso 2: valor_unitario coincide con subtotal_linea
      if (valUnit !== null && subLine !== null && Math.abs(valUnit - subLine) < 0.05) {
        valUnit = Number((subLine / cantidad).toFixed(4))
        advertencias.push(`Ítem #${idx + 1}: Se detectó que el valor unitario extraído coincidía con el subtotal de la fila. Se corrigió dividiendo entre la cantidad (${cantidad}).`)
      }
      // Caso 3: precio_compra_unitario coincide con subtotal o total de fila
      if (legacyPrice !== null) {
        const matchingTotal = legacySubtotal ?? totLine ?? subLine
        if (matchingTotal !== null && Math.abs(legacyPrice - matchingTotal) < 0.05) {
          legacyPrice = Number((matchingTotal / cantidad).toFixed(4))
          advertencias.push(`Ítem #${idx + 1}: Se corrigió el costo unitario ya que coincidía con el importe total de la fila.`)
        }
      }
    }

    return {
      descripcion: it.descripcion || `Ítem #${idx + 1}`,
      cantidad,
      unidad: it.unidad || 'NIU',
      valor_unitario: valUnit,
      precio_unitario: preUnit,
      subtotal_linea: subLine,
      total_linea: totLine,
      precio_compra_unitario: legacyPrice,
      subtotal: legacySubtotal
    }
  })

  // 3. Determinar hipótesis de impuestos y precios unitarios
  // Intentamos ver si los precios que tenemos vienen con IGV o sin IGV sumando y comparando con cabecera.
  let sumaSubtotalesPreliminar = 0
  let sumaTotalesPreliminar = 0
  let sumaLegacyPreliminar = 0

  itemsProcesados.forEach((it) => {
    // Si tenemos valor_unitario, calculamos subtotal preliminar (ex-IGV)
    const valU = it.valor_unitario ?? it.precio_compra_unitario ?? 0
    sumaSubtotalesPreliminar += it.cantidad * valU

    // Si tenemos precio_unitario, calculamos total preliminar (con IGV)
    const preU = it.precio_unitario ?? (it.valor_unitario ? it.valor_unitario * 1.18 : it.precio_compra_unitario) ?? 0
    sumaTotalesPreliminar += it.cantidad * preU

    // Legacy sum
    sumaLegacyPreliminar += it.subtotal ?? (it.cantidad * (it.precio_compra_unitario ?? 0))
  })

  // Determinar si los costos que extrajo la IA en precio_compra_unitario o subtotal corresponden a valores antes de IGV (valor de venta)
  // o valores con IGV (precio de venta/importe).
  let multiplicarPorIGV = false

  if (tipoDoc === 'factura' && cabeceraNorm.total_neto > 0) {
    const diffConLegacyTotal = Math.abs(sumaLegacyPreliminar - cabeceraNorm.total_neto)
    const diffConLegacyBruto = Math.abs(sumaLegacyPreliminar - cabeceraNorm.total_bruto)

    // Si la suma cuadra mucho mejor con el total_bruto (subtotal de factura) que con el total_neto
    // significa que los precios/subtotales extraídos de los ítems están sin IGV (ex-IGV).
    if (diffConLegacyBruto < diffConLegacyTotal && diffConLegacyBruto < 1.00 && diffConLegacyTotal > 1.00) {
      multiplicarPorIGV = true
    }
  }

  // 4. Resolver precios finales y subtotales por ítem
  const itemsNormalizados: ItemNormalizado[] = itemsProcesados.map((it) => {
    let costoFinal = 0

    // Evaluamos prioridades de extracción (con cascada de fallbacks seguros)
    if (it.precio_unitario && it.precio_unitario > 0) {
      // Prioridad 1: Precio unitario con IGV explícito
      costoFinal = it.precio_unitario
    } else if (it.valor_unitario && it.valor_unitario > 0) {
      // Prioridad 2: Valor unitario sin IGV explícito -> Multiplicar por 1.18 si es formal
      costoFinal = esFormal ? it.valor_unitario * 1.18 : it.valor_unitario
    } else if (it.total_linea && it.total_linea > 0) {
      // Prioridad 3: Total de línea con IGV explícito / cantidad
      costoFinal = it.total_linea / it.cantidad
    } else if (it.subtotal_linea && it.subtotal_linea > 0) {
      // Prioridad 4: Subtotal de línea sin IGV explícito -> Multiplicar por 1.18 si es formal
      const valU = it.subtotal_linea / it.cantidad
      costoFinal = esFormal ? valU * 1.18 : valU
    } else if (it.precio_compra_unitario && it.precio_compra_unitario > 0) {
      // Prioridad 5: Costo unitario legacy
      costoFinal = multiplicarPorIGV ? it.precio_compra_unitario * 1.18 : it.precio_compra_unitario
    } else if (it.subtotal && it.subtotal > 0) {
      // Prioridad 6: Subtotal de línea legacy
      const unitEst = it.subtotal / it.cantidad
      costoFinal = multiplicarPorIGV ? unitEst * 1.18 : unitEst
    }

    costoFinal = Number(costoFinal.toFixed(4))
    const subtotalFinal = Number((it.cantidad * costoFinal).toFixed(2))

    return {
      descripcion_factura: it.descripcion,
      cantidad: it.cantidad,
      unidad_factura: it.unidad,
      precio_compra_unitario: costoFinal,
      subtotal: subtotalFinal
    }
  })

  // 5. Advertencias finales de consistencia
  if (multiplicarPorIGV) {
    advertencias.push(
      'Se detectó que los precios de los productos en la factura fueron extraídos sin IGV (valor de venta). Se multiplicaron automáticamente por 1.18 para registrarlos incluyendo impuestos.'
    )
  }

  const sinPrecio = itemsNormalizados.filter((it) => it.precio_compra_unitario === 0).length
  if (sinPrecio > 0) {
    advertencias.push(`Se detectaron ${sinPrecio} ítems con precio de compra cero o no legibles. Deberás completarlos manualmente.`)
  }

  // Validar si la suma de subtotales finales concuerda con el total neto de la cabecera
  const sumaSubtotalesFinal = itemsNormalizados.reduce((sum, it) => sum + it.subtotal, 0)
  
  if (cabeceraNorm.total_neto > 0) {
    const diferencia = Math.abs(sumaSubtotalesFinal - cabeceraNorm.total_neto)
    if (diferencia > 0.50) {
      advertencias.push(
        `Discrepancia en importes: El total general extraído es S/. ${cabeceraNorm.total_neto.toFixed(2)}, pero la suma calculada de los ítems es S/. ${sumaSubtotalesFinal.toFixed(2)}. Diferencia de S/. ${diferencia.toFixed(2)}.`
      )
    }
  } else if (sumaSubtotalesFinal > 0) {
    // Si la cabecera no tenía total_neto pero sumamos los ítems, actualizamos la cabecera con el total calculado
    cabeceraNorm.total_neto = Number(sumaSubtotalesFinal.toFixed(2))
    cabeceraNorm.total_bruto = Number((tipoDoc === 'factura' ? cabeceraNorm.total_neto / 1.18 : cabeceraNorm.total_neto).toFixed(2))
    cabeceraNorm.igv = Number((tipoDoc === 'factura' ? cabeceraNorm.total_neto - cabeceraNorm.total_bruto : 0).toFixed(2))
  }

  return {
    cabecera: cabeceraNorm,
    items: itemsNormalizados,
    advertencias
  }
}
