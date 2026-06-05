import { UNIDADES_SUNAT } from '@/lib/constantes/unidades'

const UNIDADES_PARA_PROMPT = UNIDADES_SUNAT
  .map((u) => `${u.code} (${u.label})`)
  .join(', ')

/**
 * AGENTE 1: Orquestador / Cabecera
 * Extrae los metadatos principales del documento usando visión o texto.
 */
export function buildPromptOrquestadorCabecera(rucComprador: string | null): string {
  const rucCompradorInstruccion = rucComprador
    ? `LÓGICA INVERSA DE RUC CRÍTICA:
EL RUC DEL COMPRADOR (NOSOTROS) ES: "${rucComprador}". 
Tu objetivo es extraer el RUC del EMISOR/PROVEEDOR (Vendedor). 
Por lo tanto, el campo ruc_emisor DEBE SER DIFERENTE A "${rucComprador}". 
Si ves el RUC "${rucComprador}" en el documento, es el RUC del adquiriente/cliente, por lo que NO debes colocarlo en ruc_emisor. Busca el otro RUC que pertenezca al proveedor.`
    : 'Tu objetivo es extraer el RUC del emisor/proveedor (vendedor) que emite la factura o boleta.'

  return `Eres un agente contable Orquestador experto en ferreterías peruanas.
Tu objetivo es analizar un documento de compra (factura, boleta, nota de venta) y extraer únicamente los metadatos de la cabecera. NO te preocupes por los productos o la tabla.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "tipo_documento": "factura" | "boleta" | "nota_venta" | "ticket" | "desconocido",
  "ruc_emisor": "RUC de 11 dígitos del proveedor o null si no existe",
  "razon_social_emisor": "nombre o razón social del proveedor o null",
  "numero_factura": "número de serie-correlativo del comprobante o null",
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
 * AGENTE 2: Tipeador Literal (Constructor por Partes)
 * Extrae las filas de la tabla respetando los encabezados originales.
 */
export function buildPromptExtractorLiteral(): string {
  return `Eres un Tipeador de Tablas Estricto.
Recibirás un fragmento pequeño de una tabla de productos.
Tu ÚNICO trabajo es transcribir los bienes y servicios que veas en ese bloque a un arreglo de objetos JSON.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "filas_literales": [
    {
      "nombre_columna_1_segun_imagen": "valor",
      "nombre_columna_2_segun_imagen": 123.45
    }
  ]
}

Reglas:
1. Usa como "llaves" (keys) los NOMBRES LITERALES de las columnas que infieras del texto (Ej: "cant", "descripcion", "precio.u", "precio.v", "total").
2. Si el fragmento no contiene encabezados explícitos, infiere llaves consistentes (ej. "col1", "col2") o usa los nombres lógicos que parezcan tener los números.
3. REGLA DE ORO: NO INVENTES DATOS. NO CALCULAS NADA. Solo copia lo que ves.
4. Si un valor es numérico, ponlo como número. Si es texto, como string.
5. IGNORA y OMITE por completo cualquier fila que no sea un producto o servicio (ej. omite líneas de "Total a pagar", "IGV 18%", "Descuentos", "Vuelto", firmas, etc.). Si extraes un impuesto como producto, el sistema fallará gravemente.
6. Si en el bloque no hay productos (solo hay basura o totales), devuelve "filas_literales": [].`
}

/**
 * AGENTE 3: Detective de Columnas (Doble Validación)
 * Aplica lógica matemática a las sumas y a una fila de muestra para dar el veredicto semántico.
 */
export function buildPromptDetectiveColumnas(): string {
  return `Eres el Agente Detective Matemático.
Se te entregará una base de datos ciega (una tabla anónima de productos). Necesitamos que descubras el verdadero significado de las columnas matemáticas.

Se te proporcionará:
1. "fila_muestra": Una fila al azar de la tabla, con datos literales extraídos.
2. "sumas_columnas": La sumatoria real de cada columna numérica a lo largo de TODA la tabla completa (miles de ítems posibles).
3. "total_neto_factura": El precio total que el cliente pagó en la factura.

Tu objetivo es hacer la DOBLE VERIFICACIÓN:
Paso 1: Validación Horizontal (Fila). Toma los números de "fila_muestra". Intenta multiplicarlos entre sí. Por ejemplo, si col_x * col_y = col_z, entonces concluye que col_z es un subtotal, y que col_x e col_y son la cantidad y el precio unitario.
Paso 2: Validación Vertical (Suma Global). Toma tu candidato a "subtotal" (col_z). Revisa el valor de "sumas_columnas" para col_z. ¿Es aproximadamente igual o muy cercano a "total_neto_factura" (o total_bruto)? Si es así, CONFIRMA que col_z es definitivamente el total_linea.
Paso 3: Si hay una columna que tenga precios pero cuya multiplicación no cuadre, probablemente sea un "precio sugerido de venta al público". Identifícalo para descartarlo.

Responde ÚNICAMENTE con JSON válido con esta estructura:
{
  "conclusiones_logicas": "Texto breve explicando tus pruebas matemáticas (ej: 'ColA(12) * ColB(15) = ColC(180). La suma total de ColC es 1000, que coincide con la factura. Por ende, ColA es Cantidad y ColC es Total.')",
  "veredicto_mapeo": {
    "llave_literal_descripcion": "nombre exacto de la llave que contiene la descripcion o null",
    "llave_literal_cantidad": "nombre exacto de la llave que contiene la cantidad o null",
    "llave_literal_unidad": "nombre exacto de la llave que contiene la unidad de medida (cajas, kg, etc) o null",
    "llave_literal_precio_compra_unitario": "nombre exacto de la llave que contiene el precio unitario REAL de compra (no de venta) o null",
    "llave_literal_subtotal": "nombre exacto de la llave que contiene el importe total del producto o null"
  }
}

Reglas:
1. En "veredicto_mapeo", escribe las llaves EXACTAMENTE como vienen escritas en "fila_muestra".
2. REGLA DE ORO SEMÁNTICA: Observa muy bien el NOMBRE literal de la llave. Si una llave se llama "codigo", "cod", "sku", JAMÁS la confundas con "cantidad", no importa si la matemática coincide por casualidad. Si hay una llave llamada "cant", "cantidad" o "cto", ESA debe ser la cantidad casi con total seguridad.
3. Si un valor no existe o es imposible deducirlo, pon null en el veredicto.
4. El precio unitario de compra REAL es aquel que, multiplicado por la cantidad, se acerca al subtotal. Ignora columnas de "precio al público".`
}
