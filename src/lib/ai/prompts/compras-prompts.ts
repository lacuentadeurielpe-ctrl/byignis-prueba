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
 * (stitching de cabecera anclado en cada rebanada).
 */
export function buildPromptExtraccionCompleta(): string {
  return `Eres un extractor de precisión quirúrgica para tablas de facturas de compra peruanas.

La imagen muestra UNA SECCIÓN de la tabla de productos. La FILA SUPERIOR contiene los encabezados de columna (ej: "Código", "Cant.", "Medida", "Descripción", "V.V. Unit.", "P.V. Unit.", "Importe").

═══ INSTRUCCIONES DE LECTURA ════════════════════════════════

PASO 1 — Lee los encabezados:
Identifica visualmente qué columna corresponde a cada campo. Los nombres varían por factura:
- Descripción: la columna más ancha con texto (nombres de productos)
- Cantidad: columna numérica pequeña (enteros: 1, 2, 5, 10, 100...)
- Código: identificador alfanumérico del proveedor (puede ser "006341", "AB-123", etc.)
- Precio unitario: precio por 1 unidad
- Importe/Total línea: cantidad × precio unitario

PASO 2 — Lee fila por fila:
Para cada fila de producto extrae los valores EXACTAMENTE como aparecen visualmente.

═══ REGLAS ABSOLUTAS ════════════════════════════════════════

R1. DESCRIPCIÓN: Copia el texto completo de la celda de descripción. Incluye medidas, materiales y especificaciones (ej: "CODO PVC 3/4\" x 90° PESADO", "ALAMBRE N°8 GALV. x 25KG"). NUNCA pongas null si hay texto visible.

R2. CANTIDAD vs CÓDIGO: Son columnas DISTINTAS.
    - Si una columna se llama "Cód.", "Código", "Ref." → es el CÓDIGO, NO la cantidad.
    - Si una columna se llama "Cant.", "Ctd.", "Qty", "Cantidad" → esa es la CANTIDAD.
    - La cantidad es casi siempre un número entero sin decimales y pequeño (rango típico: 1–500).
    - Un código de 5+ dígitos como "006341" NUNCA es una cantidad.

R3. NÚMEROS LITERALES: Copia los números EXACTAMENTE como los ves. No redondees ni recalcules.
    - "1,234.56" → 1234.56
    - "1.234,56" → 1234.56  (formato peruano: punto=miles, coma=decimales)
    - "15.00" → 15.00
    - "3" → 3

R4. OMITE estas filas: totales, subtotales, "IGV 18%", descuentos globales, leyendas, firmas, líneas en blanco.

R5. Si un campo no aparece en la factura, devuelve null (no inventes valores).

R6. Unidad de medida: usa código SUNAT. Ejemplos: NIU (unidad), KGM (kilo), MTR (metro), BLL (balde), BX (caja), BAG (bolsa). Si no puedes determinarla → "NIU".

═══ FORMATO DE RESPUESTA ════════════════════════════════════

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):

{
  "items": [
    {
      "descripcion":            "<nombre completo del producto>",
      "cantidad":               <número entero>,
      "unidad":                 "<código SUNAT>",
      "valor_unitario":         <precio sin IGV o null>,
      "precio_unitario":        <precio con IGV o null>,
      "precio_compra_unitario": <precio de compra por unidad o null>,
      "subtotal":               <importe de la línea o null>
    }
  ]
}`
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
