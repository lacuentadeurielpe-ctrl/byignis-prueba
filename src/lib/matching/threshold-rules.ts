import { buscarMatchProducto, calcularSimilitud, type ProductoCatalogoMatch } from './product-matcher'

export interface ItemReconciliado {
  descripcion_factura: string
  cantidad: number
  unidad_factura: string
  precio_compra_unitario: number
  subtotal: number

  // Matching
  accion: 'crear' | 'actualizar'
  producto_existente_id: string | null
  producto_existente_nombre: string | null
  score_match: number
  sugerencias: Array<{ id: string; nombre: string; score: number }>
}

/**
 * Evalúa el matching de un ítem y aplica la regla estricta del 75%.
 * Si la coincidencia es menor a 75%, la acción por defecto es 'crear' (Producto Nuevo),
 * pero se genera un listado de las 5 mejores sugerencias ordenadas por score de similitud
 * para facilitar la vinculación manual en el frontend.
 */
export function aplicarUmbralMatching(
  item: {
    descripcion_factura: string
    cantidad: number
    unidad_factura: string
    precio_compra_unitario: number
    subtotal: number
  },
  catalogo: ProductoCatalogoMatch[],
  aliasHistoricos: { alias: string; producto_id: string }[]
): ItemReconciliado {
  const match = buscarMatchProducto(item.descripcion_factura, catalogo, aliasHistoricos)

  // Generar sugerencias ordenadas
  const sugerencias = catalogo
    .map((p) => {
      let score = 0
      const descFact = item.descripcion_factura.toLowerCase()
      
      if (p.codigo_interno && descFact.includes(p.codigo_interno.toLowerCase())) {
        score = 98
      } else {
        score = calcularSimilitud(item.descripcion_factura, p.nombre)
      }
      
      return { id: p.id, nombre: p.nombre, score }
    })
    .filter((s) => s.score > 25) // Filtrar solo las sugerencias que tengan algo de sentido
    .sort((a, b) => b.score - a.score)
    .slice(0, 5) // Mostrar máximo 5 candidatos

  const pasaUmbral = match.score >= 75

  if (pasaUmbral && match.producto_existente_id) {
    return {
      ...item,
      accion: 'actualizar',
      producto_existente_id: match.producto_existente_id,
      producto_existente_nombre: match.producto_existente_nombre,
      score_match: match.score,
      sugerencias
    }
  }

  // Si no pasa el umbral de 75%, por defecto se marca como CREAR
  return {
    ...item,
    accion: 'crear',
    producto_existente_id: null,
    producto_existente_nombre: null,
    score_match: match.score,
    sugerencias
  }
}
