// Construcción del JSON en formato modelo Greenter que Lycet deserializa (JMS).
//
// Las claves y su forma están tomadas del fixture oficial de Lycet
// (tests/Resources/documents/invoice.json) y de los modelos Greenter.
// La aritmética por línea es idéntica a la que SUNAT ya aceptó en boletas.

const IGV_RATE = 0.18

export interface EmisorLycet {
  ruc:          string
  razonSocial:  string
  direccion?:   string
  ubigeo?:      string
  departamento?: string
  provincia?:   string
  distrito?:    string
}

export interface ClienteLycet {
  tipoDoc:   string   // catálogo 06: 0=varios, 1=DNI, 6=RUC
  numDoc:    string
  rznSocial: string
}

export interface ItemLycet {
  descripcion:    string
  cantidad:       number
  precioUnitario: number   // con o sin IGV según igvIncluido
  unidad?:        string
}

export interface MapearParams {
  serie:        string
  correlativo:  number
  emisor:       EmisorLycet
  cliente:      ClienteLycet
  items:        ItemLycet[]
  igvIncluido:  boolean
  moneda?:      string    // default PEN
}

export interface Totales {
  mtoOperGravadas: number
  mtoIGV:          number
  mtoImpVenta:     number
}

// ── Unidad interna → código SUNAT (catálogo 03) ───────────────────────────────
function unidadSunat(unidad: string): string {
  const mapa: Record<string, string> = {
    // Unidad genérica
    'unid': 'NIU', 'unidad': 'NIU', 'unidades': 'NIU',
    'und': 'NIU', 'u': 'NIU', 'niu': 'NIU',
    'pza': 'NIU', 'pieza': 'NIU', 'piezas': 'NIU',
    'item': 'NIU', 'items': 'NIU',
    // Peso
    'kg': 'KGM', 'kgm': 'KGM', 'kilo': 'KGM', 'kilos': 'KGM',
    'kilogramo': 'KGM', 'kilogramos': 'KGM',
    'g': 'GRM', 'gr': 'GRM', 'gramo': 'GRM', 'gramos': 'GRM',
    'tn': 'TNE', 'ton': 'TNE', 'tonelada': 'TNE', 'toneladas': 'TNE',
    'lb': 'LBR', 'libra': 'LBR', 'libras': 'LBR',
    // Longitud
    'm': 'MTR', 'mt': 'MTR', 'mtr': 'MTR', 'metro': 'MTR', 'metros': 'MTR',
    'cm': 'CMT', 'centimetro': 'CMT', 'centimetros': 'CMT',
    'mm': 'MMT', 'milimetro': 'MMT', 'milimetros': 'MMT',
    'pie': 'FOT', 'pies': 'FOT', 'pulg': 'INH', 'pulgada': 'INH',
    // Área / Volumen
    'm2': 'MTK', 'metro2': 'MTK', 'metro cuadrado': 'MTK',
    'm3': 'MTQ', 'metro3': 'MTQ', 'metro cubico': 'MTQ',
    // Líquido
    'l': 'LTR', 'lt': 'LTR', 'ltr': 'LTR', 'litro': 'LTR', 'litros': 'LTR',
    'ml': 'MLT', 'mililitro': 'MLT', 'mililitros': 'MLT',
    'galon': 'GLL', 'galón': 'GLL', 'galones': 'GLL',
    // Empaque
    'caja': 'BX',  'cajas': 'BX',
    'bolsa': 'BG',  'bolsas': 'BG',
    'saco': 'SAC', 'sacos': 'SAC',
    'rollo': 'ROL', 'rollos': 'ROL',
    'par': 'PR',   'pares': 'PR',
    'docena': 'DZN', 'docenas': 'DZN',
    'paquete': 'PK',  'paquetes': 'PK',
    'juego': 'SET', 'juegos': 'SET',
    'kit': 'SET',
    'plancha': 'NIU', 'planchas': 'NIU',
    'varilla': 'NIU', 'varillas': 'NIU',
    'balde': 'NIU', 'baldes': 'NIU',
    'cilindro': 'NIU', 'cilindros': 'NIU',
    'bidon': 'NIU', 'bidones': 'NIU',
    'tubo': 'NIU', 'tubos': 'NIU',
    'bollon': 'NIU', 'bollones': 'NIU',
    // Servicio / Tiempo
    'serv': 'ZZ', 'servicio': 'ZZ', 'servicios': 'ZZ',
    'hr': 'HUR', 'hora': 'HUR', 'horas': 'HUR',
    'dia': 'DAY', 'días': 'DAY', 'dias': 'DAY',
  }
  return mapa[(unidad ?? '').trim().toLowerCase()] ?? 'NIU'
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ── Detalles + totales ────────────────────────────────────────────────────────
function construirDetalles(items: ItemLycet[], igvIncluido: boolean) {
  const detalles = items.map((item, i) => {
    const precio        = Number(item.precioUnitario) || 0
    const cantidad      = Number(item.cantidad) || 1
    const valorUnitario = igvIncluido ? precio / (1 + IGV_RATE) : precio
    const mtoValorVenta = round2(valorUnitario * cantidad)
    const igvItem       = round2(mtoValorVenta * IGV_RATE)

    return {
      codProducto:      String(i + 1).padStart(3, '0'),
      unidad:           unidadSunat(item.unidad ?? 'NIU'),
      descripcion:      item.descripcion ?? 'Producto',
      cantidad,
      mtoValorUnitario: round2(valorUnitario),
      mtoValorVenta,
      mtoBaseIgv:       mtoValorVenta,
      porcentajeIgv:    18.0,
      igv:              igvItem,
      tipAfeIgv:        '10',              // Gravado - Operación Onerosa
      totalImpuestos:   igvItem,
      mtoPrecioUnitario: round2(precio),
    }
  })

  const mtoOperGravadas = round2(detalles.reduce((a, d) => a + d.mtoValorVenta, 0))
  const mtoIGV          = round2(detalles.reduce((a, d) => a + d.igv, 0))
  const mtoImpVenta     = round2(mtoOperGravadas + mtoIGV)

  return { detalles, totales: { mtoOperGravadas, mtoIGV, mtoImpVenta } as Totales }
}

function crearCompany(e: EmisorLycet) {
  return {
    ruc:             e.ruc,
    razonSocial:     e.razonSocial,
    nombreComercial: e.razonSocial,
    address: {
      ubigueo:      e.ubigeo ?? '150101',
      codigoPais:   'PE',
      departamento: (e.departamento ?? 'LIMA').toUpperCase(),
      provincia:    (e.provincia ?? 'LIMA').toUpperCase(),
      distrito:     (e.distrito ?? 'LIMA').toUpperCase(),
      urbanizacion: '-',
      direccion:    e.direccion ?? '-',
    },
  }
}

function fechaEmisionLima(): string {
  // ISO con offset Lima (-05:00). Lycet/Greenter espera fechaEmision con hora.
  const ahora = new Date()
  const lima  = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${lima.getFullYear()}-${pad(lima.getMonth() + 1)}-${pad(lima.getDate())}T${pad(lima.getHours())}:${pad(lima.getMinutes())}:${pad(lima.getSeconds())}-05:00`
}

// ── Boleta (03) / Factura (01) ────────────────────────────────────────────────
export function mapearInvoice(tipoDoc: '01' | '03', p: MapearParams): { doc: any; totales: Totales } {
  const { detalles, totales } = construirDetalles(p.items, p.igvIncluido)

  const doc: any = {
    ublVersion:      '2.1',
    tipoOperacion:   '0101',
    tipoDoc,
    serie:           p.serie,
    correlativo:     String(p.correlativo),
    fechaEmision:    fechaEmisionLima(),
    tipoMoneda:      p.moneda ?? 'PEN',
    company:         crearCompany(p.emisor),
    client: {
      tipoDoc:   p.cliente.tipoDoc,
      numDoc:    p.cliente.numDoc,
      rznSocial: p.cliente.rznSocial,
    },
    mtoOperGravadas: totales.mtoOperGravadas,
    mtoIGV:          totales.mtoIGV,
    totalImpuestos:  totales.mtoIGV,
    valorVenta:      totales.mtoOperGravadas,
    subTotal:        totales.mtoImpVenta,
    mtoImpVenta:     totales.mtoImpVenta,
    details:         detalles,
    legends: [
      { code: '1000', value: numeroALetras(totales.mtoImpVenta, p.moneda ?? 'PEN') },
    ],
  }

  // La factura requiere forma de pago (UBL 2.1); la boleta no.
  if (tipoDoc === '01') {
    doc.formaPago = { tipo: 'Contado' }
  }

  return { doc, totales }
}

// ── Nota de Crédito (07) / Nota de Débito (08) ────────────────────────────────
export interface MapearNotaParams extends MapearParams {
  tipoNota:        '07' | '08'  // 07 = Nota de Crédito, 08 = Nota de Débito
  tipoDocAfectado: string   // 01 factura, 03 boleta
  numDocAfectado:  string   // ej: B001-14
  codMotivo:       string   // catálogo 09 (NC) o 10 (ND)
  desMotivo:       string
}

export function mapearNota(p: MapearNotaParams): { doc: any; totales: Totales } {
  const { detalles, totales } = construirDetalles(p.items, p.igvIncluido)

  const doc = {
    ublVersion:      '2.1',
    tipoDoc:         p.tipoNota,
    serie:           p.serie,
    correlativo:     String(p.correlativo),
    fechaEmision:    fechaEmisionLima(),
    tipDocAfectado:  p.tipoDocAfectado,
    numDocfectado:   p.numDocAfectado,      // nombre exacto del modelo Greenter (sin 'A')
    codMotivo:       p.codMotivo,
    desMotivo:       p.desMotivo,
    tipoMoneda:      p.moneda ?? 'PEN',
    company:         crearCompany(p.emisor),
    client: {
      tipoDoc:   p.cliente.tipoDoc,
      numDoc:    p.cliente.numDoc,
      rznSocial: p.cliente.rznSocial,
    },
    mtoOperGravadas: totales.mtoOperGravadas,
    mtoIGV:          totales.mtoIGV,
    totalImpuestos:  totales.mtoIGV,
    mtoImpVenta:     totales.mtoImpVenta,
    details:         detalles,
    legends: [
      { code: '1000', value: numeroALetras(totales.mtoImpVenta, p.moneda ?? 'PEN') },
    ],
  }

  return { doc, totales }
}

// ── Resumen Diario (RC) — EXCLUSIVAMENTE para dar de baja boletas ─────────────
// Desde 2023 SUNAT exige informar cada boleta individualmente (lo que el sistema
// ya hace en cada venta); el RC dejó de usarse para "declarar". Su único uso
// vigente es anular boletas ya aceptadas: un detalle con `status.type = '3'`.
// Lycet espera el modelo Greenter Summary serializado.

export interface BoletaParaRC {
  serie:    string
  numero:   number   // correlativo
  subtotal: number   // base imponible sin IGV
  igv:      number
  total:    number
}

export interface DetalleRC {
  tipoDoc:             string   // 03 = boleta
  serie:               string
  correlativoInicio:   number
  correlativoFin:      number
  billing: {
    gravadas:     number
    igv:          number
    importeTotal: number
  }
  status: { type: string }   // '3' = dar de baja
}

/** Construye el RC de baja para el conjunto de boletas dado (todas con status '3'). */
export function mapearResumenBaja(
  fecha:       string,   // YYYY-MM-DD — fecha de generación del RC
  correlativo: number,
  emisor:      EmisorLycet,
  boletas:     BoletaParaRC[],
): any {
  // Agrupar por serie
  const porSerie = new Map<string, BoletaParaRC[]>()
  for (const b of boletas) {
    const grupo = porSerie.get(b.serie) ?? []
    grupo.push(b)
    porSerie.set(b.serie, grupo)
  }

  const details: DetalleRC[] = []
  for (const [serie, grupo] of porSerie) {
    const nums    = grupo.map(b => b.numero)
    const billing = {
      gravadas:     round2(grupo.reduce((a, b) => a + (b.subtotal ?? 0), 0)),
      igv:          round2(grupo.reduce((a, b) => a + (b.igv ?? 0), 0)),
      importeTotal: round2(grupo.reduce((a, b) => a + (b.total ?? 0), 0)),
    }
    details.push({
      tipoDoc:           '03',
      serie,
      correlativoInicio: Math.min(...nums),
      correlativoFin:    Math.max(...nums),
      billing,
      status:            { type: '3' },
    })
  }

  return {
    correlativo,
    fecGeneracion: fecha,
    company:       crearCompany(emisor),
    details,
  }
}

// ── Comunicación de Baja (RA) — anulación de facturas/notas ───────────────────
// Documento Greenter "Voided" (distinto del Summary). Regla SUNAT: solo puede
// comunicarse la baja a partir del día siguiente a la emisión del documento.

export interface DocumentoParaBaja {
  tipoDoc:     string   // 01 = factura, 07 = NC, 08 = ND
  serie:       string
  correlativo: number
  motivo:      string
}

export function mapearComunicacionBaja(
  fechaComunicacion: string,   // YYYY-MM-DD — hoy (cuándo se envía la RA)
  fechaGeneracion:   string,   // YYYY-MM-DD — fecha del/los documento(s) afectados
  correlativo:       number,
  emisor:            EmisorLycet,
  documentos:        DocumentoParaBaja[],
): any {
  return {
    correlativo,
    fecGeneracion:   fechaGeneracion,
    fecComunicacion: fechaComunicacion,
    company:         crearCompany(emisor),
    details: documentos.map(d => ({
      tipoDoc:      d.tipoDoc,
      serie:        d.serie,
      correlativo:  String(d.correlativo),
      desMotivoBaja: d.motivo,
    })),
  }
}

// ── Número a letras (para la leyenda 1000) ────────────────────────────────────
function numeroALetras(monto: number, moneda: string): string {
  const entero   = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  const sufijo   = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES'
  return `SON ${enteroALetras(entero).toUpperCase()} CON ${String(centavos).padStart(2, '0')}/100 ${sufijo}`
}

function enteroALetras(n: number): string {
  if (n === 0) return 'CERO'

  const unidades   = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
  const especiales  = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const decenas    = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const centenas   = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

  let resultado = ''

  if (n >= 1000000) {
    const m = Math.floor(n / 1000000)
    resultado += (m === 1 ? 'UN MILLÓN' : enteroALetras(m) + ' MILLONES') + ' '
    n %= 1000000
  }
  if (n >= 1000) {
    const m = Math.floor(n / 1000)
    resultado += (m === 1 ? 'MIL' : enteroALetras(m) + ' MIL') + ' '
    n %= 1000
  }
  if (n >= 100) {
    const c = Math.floor(n / 100)
    resultado += (n === 100 ? 'CIEN' : centenas[c]) + ' '
    n %= 100
  }
  if (n >= 20) {
    const d = Math.floor(n / 10)
    const u = n % 10
    resultado += decenas[d] + (u > 0 ? ' Y ' + unidades[u] : '') + ' '
  } else if (n >= 10) {
    resultado += especiales[n - 10] + ' '
  } else if (n > 0) {
    resultado += (n === 1 ? 'UNO' : unidades[n]) + ' '
  }

  return resultado.trim()
}
