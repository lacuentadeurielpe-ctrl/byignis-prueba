/**
 * compras-prompts.ts — Prompts para extracción de facturas de compra (v3)
 *
 * Solo dos prompts:
 *   1. buildPromptCabecera      — extrae metadatos del documento (RUC, número, total...)
 *   2. buildPromptExtraccionCompleta — extrae la tabla de productos de una imagen
 *                                     que YA contiene visualmente los encabezados de columna.
 */

import { UNIDADES_SUNAT } from '@/lib/constantes/unidades'

const UNIDADES_LISTA = UNIDADES_SUNAT
  .map(u => `${u.code} (${u.label})`)
  .join(', ')

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt 1: Cabecera del documento
 * Extrae SOLO los metadatos del comprobante, sin tocar la tabla de productos.
 */
export function buildPromptCabecera(rucComprador: string | null): string {
  const rucInstruccion = rucComprador
    ? `ATENCIÓN — RUC DEL COMPRADOR (nosotros): "${rucComprador}".
El campo ruc_emisor debe contener el RUC del PROVEEDOR (quien vende), que es DIFERENTE a "${rucComprador}".
Si ves "${rucComprador}" en el documento, ese es el RUC del cliente/adquiriente — ignóralo para ruc_emisor.`
    : 'Extrae el RUC del emisor/proveedor (quien emite el comprobante).'

  return `Eres un asistente contable experto en documentos tributarios peruanos (facturas, boletas, notas de venta).
Tu ÚNICA tarea es extraer los metadatos de la CABECERA del documento — NO leas la tabla de productos.

${rucInstruccion}

Responde SOLO con este JSON (sin texto adicional):
{
  "tipo_documento": "factura" | "boleta" | "nota_venta" | "ticket" | "desconocido",
  "ruc_emisor": "RUC de 11 dígitos del proveedor, o null",
  "razon_social_emisor": "Nombre o razón social del proveedor, o null",
  "numero_factura": "Número serie-correlativo (ej: F001-00012345), o null",
  "fecha_factura": "Fecha en formato YYYY-MM-DD, o null",
  "total_bruto": <número: base imponible antes de IGV si es factura, o total si es boleta/nota, o null>,
  "igv": <número: importe del IGV si es factura, 0 si es boleta/nota, o null>,
  "total_neto": <número: importe total a pagar, o null>
}

Reglas:
- "factura" y "boleta" son documentos formales con RUC.
- "nota_venta" y "ticket" son informales (sin RUC válido).
- Todos los montos en soles (S/).`
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt 2: Extracción de ítems de la tabla de productos
 *
 * La imagen SIEMPRE contiene visualmente los encabezados de columna
 * (porque aplicamos stitching de cabecera antes de enviar).
 * El modelo debe leer los encabezados de la propia imagen y extraer filas.
 */
export function buildPromptExtraccionCompleta(): string {
  return `Eres un extractor experto de tablas de facturas de compra peruanas (ferreterías, distribuidoras, etc.).

La imagen que recibirás muestra UNA SECCIÓN de la tabla de productos de una factura.
La imagen SIEMPRE incluye los encabezados de columna en la parte superior (aunque sea repetida).

TU TAREA:
Leer la imagen fila por fila y extraer CADA PRODUCTO con los siguientes campos:

{
  "items": [
    {
      "descripcion":            "<texto completo del nombre/descripción del producto>",
      "cantidad":               <número>,
      "unidad":                 "<código de unidad: NIU, KGM, MTR, etc.>",
      "valor_unitario":         <número o null — precio sin IGV por unidad>,
      "precio_unitario":        <número o null — precio con IGV por unidad>,
      "precio_compra_unitario": <número o null — el precio de compra real por unidad>,
      "subtotal":               <número o null — importe total de esa línea>
    }
  ]
}

REGLAS CRÍTICAS:
1. Lee los encabezados de la imagen para saber qué columna es qué. NO asumas un orden fijo.
2. "descripcion" es la columna de texto más ancha — contiene el nombre completo del producto (ej: "NIPLE BRONCE 1/2\\"  X 2\\""). NUNCA la dejes vacía si hay texto en esa celda.
3. "cantidad" es la cantidad comprada (generalmente un número entero pequeño como 5, 12, 100). NO confundas el código del producto (6 dígitos como "006341") con la cantidad.
4. El campo "código" o "cod" de la factura es un identificador interno del proveedor — NO es la cantidad.
5. Para "precio_compra_unitario" usa el precio unitario real de compra (valor neto o precio de venta, según lo que tenga la factura).
6. Para "subtotal" usa el importe total de la línea (cantidad × precio unitario).
7. OMITE filas de totales, subtotales, IGV, descuentos globales, firmas o líneas vacías.
8. Si un campo no existe en la imagen, devuelve null para ese campo.
9. La unidad debe ser un código SUNAT estándar: ${UNIDADES_LISTA}. Si no puedes determinarla, usa "NIU".

IMPORTANTE: Responde SOLO con el JSON. Sin explicaciones.`
}

// ─────────────────────────────────────────────────────────────────────────────
// Los siguientes exports se mantienen por compatibilidad con otros archivos
// que puedan importarlos, aunque ya no se usan en compras-ai.ts v3.
export function buildPromptOrquestadorCabecera(rucComprador: string | null): string {
  return buildPromptCabecera(rucComprador)
}

export function buildPromptLectorCabezal(): string {
  return '{"encabezados_maestros": []}'  // No usado en v3
}

export function buildPromptExtractorLiteral(encabezados: string[]): string {
  return buildPromptExtraccionCompleta()  // Redirige al nuevo prompt
}

export function buildPromptDetectiveColumnas(): string {
  return '{"veredicto_mapeo": {}}'  // No usado en v3
}
