import { UNIDADES_SUNAT } from '@/lib/constantes/unidades'

const UNIDADES_PARA_PROMPT = UNIDADES_SUNAT
  .map((u) => `${u.code} (${u.label})`)
  .join(', ')

/**
 * Construye el prompt de sistema para el agente de cabecera, inyectando el RUC del comprador (ferretería)
 * para evitar confusiones de facturación.
 */
export function buildPromptCabecera(rucComprador: string | null): string {
  const rucCompradorInstruccion = rucComprador
    ? `EL RUC DEL COMPRADOR (NOSOTROS) ES: "${rucComprador}". Tu objetivo es extraer el RUC del EMISOR/PROVEEDOR (Vendedor). Por lo tanto, el campo ruc_emisor DEBE SER DIFERENTE A "${rucComprador}". Si ves el RUC "${rucComprador}" en el documento, es el RUC del adquiriente/cliente, por lo que NO debes colocarlo en ruc_emisor.`
    : 'Tu objetivo es extraer el RUC del emisor/proveedor (vendedor) que emite la factura o boleta.'

  return `Eres un agente contable experto en ferreterías peruanas.
Tu objetivo es analizar la/s imagen/es de una compra (factura, boleta, nota de venta) y clasificar el tipo de documento y extraer los metadatos de cabecera.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "tipo_documento": "factura" | "boleta" | "nota_venta" | "ticket" | "desconocido",
  "ruc_emisor": "RUC de 11 dígitos del proveedor o null si no existe",
  "razon_social_emisor": "nombre o razón social del proveedor o null",
  "numero_factura": "número de serie-correlativo del comprobante (ej: F001-12345, B003-999) o null",
  "fecha_factura": "fecha en formato YYYY-MM-DD o null",
  "total_bruto": número base imponible (subtotal antes de IGV si es factura formal, de lo contrario total) o null,
  "igv": número de IGV extraído o calculado (18% si es factura formal, de lo contrario 0) o null,
  "total_neto": número del monto total a pagar o null
}

Reglas:
1. "factura" y "boleta" son formales. "nota_venta" y "ticket" son informales.
2. Si es una Factura, extrae o calcula el total_bruto (Base Imponible) e igv (18% de total_bruto).
3. Si es Boleta o Nota de Venta, total_neto es igual a total_bruto, y el igv debe ser 0.
4. Responde en soles peruanos (S/).
5. ${rucCompradorInstruccion}`
}

/**
 * Construye el prompt de sistema para el agente de extracción de ítems.
 */
export function buildPromptItems(): string {
  return `Eres un agente de inventario experto en ferreterías peruanas.
Tu objetivo es analizar la/s imagen/es de la compra y extraer la lista completa de ítems comprados.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "items": [
    {
      "descripcion": "nombre o descripción del producto comprado",
      "cantidad": número de unidades compradas (entero o decimal) o null,
      "unidad": "código SUNAT de la unidad de medida (ver lista) o null",
      
      // Montos unitarios (si figuran de forma explícita, de lo contrario null)
      "valor_unitario": número del valor unitario sin IGV o null,
      "precio_unitario": número del precio unitario con IGV o null,
      
      // Montos de línea/totales de fila (si figuran de forma explícita, de lo contrario null)
      "subtotal_linea": número del valor de venta total de la línea (ex-IGV) o null,
      "total_linea": número del precio de venta total de la línea (con IGV) o null,
      
      // Campos heredados para compatibilidad
      "precio_compra_unitario": número estimado del costo unitario de compra (con o sin IGV) o null,
      "subtotal": número estimado del total de la línea o null
    }
  ]
}

UNIDADES VÁLIDAS (Usa EXACTAMENTE el código SUNAT):
${UNIDADES_PARA_PROMPT}

Reglas e Información de Contexto:
1. Extrae todos los ítems legibles del documento.
2. Mapea la unidad al código SUNAT. Por ejemplo: "unidad", "und", "pza", "tubo", "balde" -> NIU; "caja" -> BX; "bolsa" -> BG; "rollo" -> ROL; "metro" -> MTR; "kilo", "kg" -> KGM.
3. Terminología común en comprobantes peruanos (para guiar tu extracción):
   - "Valor de Venta" o "V. Venta" en las filas de la tabla suele representar el subtotal de la línea antes de impuestos (cantidad x valor unitario). Mapealo a "subtotal_linea".
   - "Precio de Venta" o "P. Venta" o "Importe" en las filas suele representar el total de la línea incluyendo impuestos (cantidad x precio unitario). Mapealo a "total_linea".
   - "Valor Unitario" o "V/U" o "Precio Unit. sin IGV" es el costo unitario antes de impuestos. Mapealo a "valor_unitario".
   - "Precio Unitario" o "P/U" o "Precio Unit. con IGV" es el costo unitario incluyendo impuestos. Mapealo a "precio_unitario".
4. Si algunas de estas columnas no están presentes o legibles en el comprobante, simplemente colócalas como null. No fuerces cálculos complejos que puedan inducir a error; el sistema se encargará de resolver los valores faltantes matemáticamente.`
}
