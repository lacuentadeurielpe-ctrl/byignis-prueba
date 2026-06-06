import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 'normal' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' }
  ]
})

// ── Colores de la paleta (Estilo Compra - tonos esmeralda/verde para compras) ──
const COLORS = {
  primary: '#064e3b',      // Verde muy oscuro
  primaryLight: '#059669', // Verde medio
  accent: '#10b981',       // Verde vibrante
  bg: '#f8fafc',           
  bgStripe: '#f1f5f9',     
  border: '#cbd5e0',       
  text: '#1a202c',         
  textMuted: '#718096',    
  white: '#ffffff',
}

// ── Estilos profesionales A4 ──
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    padding: 0,
  },
  headerBand: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    backgroundColor: COLORS.white,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    minWidth: 180,
  },
  empresaNombre: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 2,
  },
  empresaRazon: {
    fontSize: 9,
    color: '#a7f3d0',
    marginBottom: 1,
  },
  empresaInfo: {
    fontSize: 8,
    color: '#d1fae5',
  },
  tipoDocLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  rucBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 2,
    textAlign: 'center',
  },
  numComprobante: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.accent,
    textAlign: 'center',
  },
  accentBar: {
    height: 4,
    backgroundColor: COLORS.accent,
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 18,
    paddingBottom: 20,
    flex: 1,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  tableHeaderText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: COLORS.bgStripe,
  },
  colNum: { width: '6%', textAlign: 'center' },
  colCant: { width: '10%', textAlign: 'center' },
  colDesc: { width: '44%' },
  colPrecio: { width: '18%', textAlign: 'right' },
  colSubtotal: { width: '22%', textAlign: 'right' },
  totalesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  totalesBox: {
    width: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  totalesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  totalFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary,
  },
  totalFinalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  totalFinalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legalBox: {
    flex: 1,
    alignItems: 'center',
  },
  legalText: {
    fontSize: 7,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 1,
  },
  bottomBand: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 40,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  bottomText: {
    fontSize: 7,
    color: '#a7f3d0',
    textAlign: 'center',
  },
})

// ── Tipos de datos ──
export interface CompraPdfData {
  ferreteria: {
    razon_social: string
    nombre_comercial: string
    ruc: string
    direccion: string
  }
  compra: {
    numero_registro: string
    numero_factura: string
    tipo: 'formal' | 'informal' | 'mixta'
    fecha: string
    proveedor_nombre: string
    proveedor_ruc: string
    subtotal: number
    igv: number
    total: number
    estado: string
  }
  items: Array<{
    cantidad: number
    descripcion: string
    precio_unitario: number
    subtotal: number
  }>
}

export default function PlantillaCompra({ data }: { data: CompraPdfData }) {
  let fechaFormateada = ''
  try {
    fechaFormateada = format(new Date(data.compra.fecha), 'dd/MM/yyyy')
  } catch {
    fechaFormateada = data.compra.fecha || 'N/A'
  }

  const tipoLabel = 'REGISTRO DE COMPRA'
  const isFormal = data.compra.tipo === 'formal'
  const esBorrador = data.compra.estado === 'borrador'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── HEADER ── */}
        <View style={styles.headerBand}>
          <View style={styles.headerLeft}>
            <Text style={styles.empresaNombre}>{data.ferreteria.nombre_comercial}</Text>
            <Text style={styles.empresaRazon}>{data.ferreteria.razon_social} | RUC: {data.ferreteria.ruc}</Text>
            <Text style={styles.empresaInfo}>{data.ferreteria.direccion}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.tipoDocLabel}>{tipoLabel}</Text>
            <Text style={styles.rucBadge}>{esBorrador ? '(BORRADOR)' : 'OFICIAL'}</Text>
            <Text style={styles.numComprobante}>{data.compra.numero_registro}</Text>
          </View>
        </View>
        <View style={styles.accentBar} />

        {/* ── BODY ── */}
        <View style={styles.body}>
          {/* ── Info del Proveedor ── */}
          <View style={styles.infoSection}>
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>Proveedor</Text>
              <Text style={styles.infoValue}>{data.compra.proveedor_nombre || 'Desconocido'}</Text>
              <Text style={styles.infoLabel}>RUC / Documento</Text>
              <Text style={styles.infoValue}>{data.compra.proveedor_ruc || 'Sin documento'}</Text>
            </View>
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>Fecha de Emision</Text>
              <Text style={styles.infoValue}>{fechaFormateada}</Text>
              <Text style={styles.infoLabel}>N° Documento Emisor</Text>
              <Text style={styles.infoValue}>{data.compra.numero_factura || 'N/A'}</Text>
            </View>
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>Tipo de Compra</Text>
              <Text style={styles.infoValue}>{isFormal ? 'CON FACTURA' : 'SIN FACTURA'}</Text>
              <Text style={styles.infoLabel}>Moneda</Text>
              <Text style={styles.infoValue}>SOLES (PEN)</Text>
            </View>
          </View>

          {/* ── Tabla de items ── */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colNum]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.colCant]}>CANT.</Text>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>PRODUCTO</Text>
            <Text style={[styles.tableHeaderText, styles.colPrecio]}>P. UNIT.</Text>
            <Text style={[styles.tableHeaderText, styles.colSubtotal]}>IMPORTE</Text>
          </View>

          {data.items.map((item, i) => (
            <View
              key={i}
              style={[styles.tableRow, i % 2 !== 0 ? styles.tableRowAlt : {}]}
            >
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colCant}>{item.cantidad}</Text>
              <Text style={styles.colDesc}>{item.descripcion}</Text>
              <Text style={styles.colPrecio}>S/ {item.precio_unitario.toFixed(2)}</Text>
              <Text style={styles.colSubtotal}>S/ {item.subtotal.toFixed(2)}</Text>
            </View>
          ))}

          {/* ── Totales ── */}
          <View style={styles.totalesContainer}>
            <View style={styles.totalesBox}>
              <View style={styles.totalesRow}>
                <Text>Subtotal</Text>
                <Text>S/ {data.compra.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.totalesRow}>
                <Text>IGV (18%)</Text>
                <Text>S/ {data.compra.igv.toFixed(2)}</Text>
              </View>
              <View style={styles.totalFinalRow}>
                <Text style={styles.totalFinalLabel}>TOTAL NETO</Text>
                <Text style={styles.totalFinalValue}>S/ {data.compra.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* ── Footer Legal ── */}
          <View style={styles.footerSection}>
            <View style={styles.legalBox}>
              <Text style={styles.legalText}>Documento interno generado por sistema para respaldo y cuadre de inventario.</Text>
              <Text style={[styles.legalText, { marginTop: 6, fontWeight: 'bold', color: COLORS.text }]}>
                {esBorrador ? 'Este documento aun no ha sido ingresado al stock de almacén.' : 'Este documento ya actualizó los stocks del almacén.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Bottom band ── */}
        <View style={styles.bottomBand}>
          <Text style={styles.bottomText}>
            {data.ferreteria.nombre_comercial}  |  Registro Interno de Compras
          </Text>
        </View>
      </Page>
    </Document>
  )
}
