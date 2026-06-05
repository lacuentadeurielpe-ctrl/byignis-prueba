import { UNIDADES_SUNAT } from '@/lib/constantes/unidades'

const UNIDADES_PARA_PROMPT = UNIDADES_SUNAT
  .map((u) => `${u.code} (${u.label})`)
  .join(', ')

/**
 * Construye el prompt de sistema para el agente de visión consolidado.
 * Extrae la cabecera del documento y las filas de productos de forma plana (líneas de texto).
 */
export function buildPromptVisionConsolidado(rucComprador: string | null): string {
  const rucCompradorInstruccion = rucComprador
    ? `EL RUC DEL COMPRADOR (NOSOTROS) ES: "${rucComprador}". Tu objetivo es extraer el RUC del EMISOR/PROVEEDOR (Vendedor). Por lo tanto, el campo ruc_emisor DEBE SER DIFERENTE A "${rucComprador}". Si ves el RUC "${rucComprador}" en el documento, es el RUC del adquiriente/cliente, por lo que NO debes colocarlo en ruc_emisor.`
    : 'Tu objetivo es extraer el RUC del emisor/proveedor (vendedor) que emite la factura o boleta.'

  return `Eres un agente contable experto en ferreterías peruanas.
Tu objetivo es analizar la/s imagen/es de una compra (factura, boleta, nota de venta) y clasificar el tipo de documento, extraer los metadatos de cabecera y transcribir las filas de la tabla de productos de forma plana.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "tipo_documento": "factura" | "boleta" | "nota_venta" | "ticket" | "desconocido",
  "ruc_emisor": "RUC de 11 dígitos del proveedor o null si no existe",
  "razon_social_emisor": "nombre o razón social del proveedor o null",
  "numero_factura": "número de serie-correlativo del comprobante (ej: F001-12345, B003-999) o null",
  "fecha_factura": "fecha en formato YYYY-MM-DD o null",
  "total_bruto": número base imponible (subtotal antes de IGV si es factura formal, de lo contrario total) o null,
  "igv": número de IGV extraído o calculado (18% si es factura formal, de lo contrario 0) o null,
  "total_neto": número del monto total a pagar o null,
  "lineas_tabla": [
    "transcripción exacta de la línea 1 de la tabla de productos",
    "transcripción exacta de la línea 2 de la tabla de productos"
  ]
}

Reglas:
1. "factura" y "boleta" son formales. "nota_venta" y "ticket" son informales.
2. Si es una Factura, extrae o calcula el total_bruto (Base Imponible) e igv (18% de total_bruto).
3. Si es Boleta o Nota de Venta, total_neto es igual a total_bruto, y el igv debe ser 0.
4. Responde en soles peruanos (S/).
5. ${rucCompradorInstruccion}
6. En "lineas_tabla", debes colocar una lista de cadenas de texto. Cada cadena debe transcribir horizontalmente TODO el contenido de una fila de la tabla de productos (incluyendo cantidad, descripción, códigos, precios unitarios y totales de fila). No dejes fuera ningún ítem. Transcribe fielmente lo que ves en la imagen de izquierda a derecha. Si hay múltiples páginas, junta todas las filas en este único arreglo.`
}

/**
 * Construye el prompt de sistema para el agente de texto que parsea las líneas de tabla en JSON.
 */
export function buildPromptParserTextoItems(): string {
  return `Eres un agente de inventario experto en ferreterías peruanas y estructuración de datos.
Tu objetivo es analizar una lista de renglones/líneas transcritas de una tabla de compras y estructurar cada fila en un formato JSON limpio y estandarizado.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "items": [
    {
      "descripcion": "nombre o descripción limpia del producto comprado",
      "cantidad": número de unidades compradas (entero o decimal) o null,
      "unidad": "código SUNAT de la unidad de medida (ver lista) o null",
      
      // Montos unitarios (si figuran de forma explícita, de lo contrario null)
      "valor_unitario": número del valor unitario sin IGV o null,
      "precio_unitario": número del precio unitario con IGV o null,
      
      // Montos de línea/totales de fila (si figuran de forma explícita, de lo contrario null)
      "subtotal_linea": número del valor de venta total de la línea (ex-IGV) o null,
      "total_linea": número del precio de venta total de la línea (con IGV) o null,
      
      // Campos heredados para compatibilidad
      "precio_compra_unitario": número estimado del costo unitario de compra o null,
      "subtotal": número estimado del total de la línea o null
    }
  ]
}

UNIDADES VÁLIDAS (Usa EXACTAMENTE el código SUNAT):
${UNIDADES_PARA_PROMPT}

Reglas de Negocio:
1. Analiza cada línea de texto plano de forma independiente.
2. Extrae las variables numéricas prestando atención a la posición de las columnas lógicas implicadas:
   - Identifica si un precio es unitario (un valor bajo cerca de la descripción o cantidad) o de línea (un valor alto, resultado de cantidad x unitario).
   - Intenta deducir si el precio está grabado antes de impuestos (a menudo denominado "Valor Unitario", "V.U.", "sin IGV", "V. Venta") o con impuestos ("Precio Unitario", "P.U.", "con IGV", "Importe", "Total").
3. Si no es claro o falta algún campo, colócalo como null. No inventes cálculos; el reconciliador matemático se encargará de completarlos.
4. Mapea la unidad al código SUNAT. Por ejemplo: "unidad", "und", "pza", "tubo", "balde" -> NIU; "caja" -> BX; "bolsa" -> BG; "rollo" -> ROL; "metro" -> MTR; "kilo", "kg" -> KGM.`
}
