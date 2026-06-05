// Módulo de Matching Inteligente para productos en compras
import { normalizarUnidad } from '@/lib/constantes/unidades'

// Diccionario de abreviaturas comunes en ferreterías peruanas
const ABREVIATURAS_FERRETERAS: Record<string, string> = {
  cem: 'cemento',
  tb: 'tubo',
  tub: 'tubo',
  fo: 'fierro',
  fierr: 'fierro',
  glv: 'galvanizado',
  galv: 'galvanizado',
  pza: 'pieza',
  und: 'unidad',
  unid: 'unidad',
  blsa: 'bolsa',
  bol: 'bolsa',
  plnch: 'plancha',
  pgo: 'pego',
  pgo_rapido: 'pego rapido',
  acc: 'accesorio',
  accesor: 'accesorio',
  disco_corte: 'disco de corte',
  al: 'alambre',
  almbr: 'alambre',
  clv: 'clavo',
  clav: 'clavo',
  pnt: 'pintura',
  pint: 'pintura',
  cpp: 'cpp', // marca común de pinturas
  kpr: 'kipper', // marca común de tubos
  pavco: 'pavco',
  dewalt: 'dewalt',
  makita: 'makita',
  bosch: 'bosch',
  truper: 'truper',
}

/**
 * Normaliza una cadena de texto eliminando caracteres especiales, tildes y espacios duplicados.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/."'-]/g, '') // mantener barras, comillas para pulgadas
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Expande las abreviaturas conocidas dentro de una descripción de producto.
 */
export function expandirAbreviaturas(texto: string): string {
  const palabras = normalizarTexto(texto).split(' ')
  const palabrasExpandidas = palabras.map((p) => {
    // Quitar puntuación al final de la palabra para matchear abreviaturas (ej: "tb.")
    const palabraLimpia = p.replace(/[.,]/g, '')
    if (ABREVIATURAS_FERRETERAS[palabraLimpia]) {
      return ABREVIATURAS_FERRETERAS[palabraLimpia]
    }
    return p
  })
  return palabrasExpandidas.join(' ')
}

/**
 * Calcula la distancia de Levenshtein entre dos strings.
 */
function calcularDistanciaLevenshtein(a: string, b: string): number {
  const matriz: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matriz[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matriz[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matriz[i][j] = matriz[i - 1][j - 1]
      } else {
        matriz[i][j] = Math.min(
          matriz[i - 1][j - 1] + 1, // sustitución
          matriz[i][j - 1] + 1,     // inserción
          matriz[i - 1][j] + 1      // eliminación
        )
      }
    }
  }

  return matriz[b.length][a.length]
}

/**
 * Calcula un score de similitud entre 0 y 100.
 */
export function calcularSimilitud(textoFactura: string, textoCatalogo: string): number {
  const facturaExp = expandirAbreviaturas(textoFactura)
  const catalogoExp = expandirAbreviaturas(textoCatalogo)

  // 1. Coincidencia exacta
  if (facturaExp === catalogoExp) return 100

  // 2. Contención total
  if (facturaExp.includes(catalogoExp) || catalogoExp.includes(facturaExp)) {
    // Penalizar ligeramente por diferencia de tamaño
    const diferencia = Math.abs(facturaExp.length - catalogoExp.length)
    return Math.max(75, 95 - diferencia)
  }

  // 3. Similitud por palabras compartidas
  const palabrasFactura = new Set(facturaExp.split(' ').filter((p) => p.length > 2))
  const palabrasCatalogo = new Set(catalogoExp.split(' ').filter((p) => p.length > 2))

  if (palabrasFactura.size === 0 || palabrasCatalogo.size === 0) return 0

  let coincidencias = 0
  for (const p of palabrasFactura) {
    if (palabrasCatalogo.has(p)) {
      coincidencias++
    }
  }

  const menorTamano = Math.min(palabrasFactura.size, palabrasCatalogo.size)
  const scorePalabras = (coincidencias / menorTamano) * 100

  // Si hay buena coincidencia de palabras clave, usamos Levenshtein para afinar
  if (scorePalabras >= 50) {
    const maxLen = Math.max(facturaExp.length, catalogoExp.length)
    const dist = calcularDistanciaLevenshtein(facturaExp, catalogoExp)
    const scoreLevenshtein = ((maxLen - dist) / maxLen) * 100
    // Promedio ponderado (60% Levenshtein, 40% palabras compartidas)
    return Math.round(scoreLevenshtein * 0.6 + scorePalabras * 0.4)
  }

  return Math.round(scorePalabras)
}

export interface ProductoCatalogoMatch {
  id: string
  nombre: string
  codigo_interno: string | null
  unidad: string | null
  precio_base: number
  precio_compra: number
  stock: number
}

export interface ResultadoMatch {
  accion: 'actualizar' | 'crear'
  producto_existente_id: string | null
  producto_existente_nombre: string | null
  score: number // de 0 a 100
}

/**
 * Realiza el matching de un ítem extraído de factura contra el catálogo existente
 * y la base de datos de alias históricos de la ferretería.
 */
export function buscarMatchProducto(
  nombreExtraido: string,
  catalogo: ProductoCatalogoMatch[],
  aliasHistoricos: { alias: string; producto_id: string }[]
): ResultadoMatch {
  if (!nombreExtraido) {
    return { accion: 'crear', producto_existente_id: null, producto_existente_nombre: null, score: 0 }
  }

  const nombreNorm = normalizarTexto(nombreExtraido)

  // ── Capa B: Búsqueda exacta en alias históricos (Memoria) ───────────────────
  const aliasMatch = aliasHistoricos.find((a) => normalizarTexto(a.alias) === nombreNorm)
  if (aliasMatch) {
    const producto = catalogo.find((p) => p.id === aliasMatch.producto_id)
    if (producto) {
      return {
        accion: 'actualizar',
        producto_existente_id: producto.id,
        producto_existente_nombre: producto.nombre,
        score: 100, // alias confirmado por usuario
      }
    }
  }

  // ── Capa C: Fuzzy search sobre catálogo ─────────────────────────────────────
  let mejorMatch: ProductoCatalogoMatch | null = null
  let mejorScore = 0

  for (const prod of catalogo) {
    // Si coincide el código interno (si el OCR lo leyó)
    if (prod.codigo_interno && nombreNorm.includes(normalizarTexto(prod.codigo_interno))) {
      return {
        accion: 'actualizar',
        producto_existente_id: prod.id,
        producto_existente_nombre: prod.nombre,
        score: 98,
      }
    }

    const score = calcularSimilitud(nombreExtraido, prod.nombre)
    if (score > mejorScore) {
      mejorScore = score
      mejorMatch = prod
    }
  }

  // Umbral de aceptación para auto-match: 75%
  const umbralAutoMatch = 75

  if (mejorScore >= umbralAutoMatch && mejorMatch) {
    return {
      accion: 'actualizar',
      producto_existente_id: mejorMatch.id,
      producto_existente_nombre: mejorMatch.nombre,
      score: mejorScore,
    }
  }

  // Si está por encima de 45%, lo sugerimos como "actualizar" pero con score bajo (para que la UI llame la atención)
  // De lo contrario, se sugiere crear uno nuevo.
  if (mejorScore >= 45 && mejorMatch) {
    return {
      accion: 'actualizar',
      producto_existente_id: mejorMatch.id,
      producto_existente_nombre: mejorMatch.nombre,
      score: mejorScore,
    }
  }

  return {
    accion: 'crear',
    producto_existente_id: null,
    producto_existente_nombre: null,
    score: mejorScore,
  }
}
