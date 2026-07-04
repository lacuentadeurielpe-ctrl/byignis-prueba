import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatFecha, formatMonto, registerFonts } from '../shared/helpers'
import { PropsFactura } from './types'

export default function PlantillaFacturaCompacta({ emisor, comprobante, items, tema }: PropsFactura) {
  registerFonts()

  const styles = StyleSheet.create({
    page: { padding: 20, fontFamily: 'Roboto', fontSize: 9, color: '#000' },
    
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 2, borderBottomColor: tema.primario, paddingBottom: 10 },
    logo: { width: 80, objectFit: 'contain', marginRight: 15 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 14, fontWeight: 'bold', color: tema.primario },
    emisorText: { fontSize: 8, color: '#444' },
    
    docBox: { alignItems: 'flex-end', width: 140 },
    docType: { fontSize: 10, fontWeight: 'bold' },
    docNum: { fontSize: 12, color: tema.primario, fontWeight: 'bold' },
    docRuc: { fontSize: 9, fontWeight: 'bold' },

    clientRow: { flexDirection: 'row', marginBottom: 10, backgroundColor: '#f5f5f5', padding: 5, borderRadius: 4 },
    clientItem: { flex: 1 },
    clientLabel: { fontSize: 7, color: '#666', fontWeight: 'bold' },
    clientValue: { fontSize: 9 },

    table: { width: '100%', marginBottom: 15 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 4, marginBottom: 4, fontWeight: 'bold' },
    tableRow: { flexDirection: 'row', marginBottom: 4 },
    col1: { width: '10%' },
    col2: { width: '50%' },
    col3: { width: '20%', textAlign: 'right' },
    col4: { width: '20%', textAlign: 'right' },

    totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 10 },
    totalsBox: { width: 160 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    totalBold: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, fontWeight: 'bold', fontSize: 11 },

    footer: { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-end' },
    qrBox: { width: 50, height: 50, marginRight: 10 },
    legalBox: { flex: 1 },
    legalText: { fontSize: 7, color: '#666' }
  })

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.headerRow}>
          {emisor.logo_url && <Image src={emisor.logo_url} style={styles.logo} />}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{emisor.nombre_comercial}</Text>
            <Text style={styles.emisorText}>{emisor.razon_social}</Text>
            <Text style={styles.emisorText}>{emisor.direccion}</Text>
          </View>
          <View style={styles.docBox}>
            <Text style={styles.docRuc}>RUC: {emisor.ruc}</Text>
            <Text style={styles.docType}>FACTURA ELECTRÓNICA</Text>
            <Text style={styles.docNum}>{comprobante.numero_completo}</Text>
          </View>
        </View>

        <View style={styles.clientRow}>
          <View style={styles.clientItem}>
            <Text style={styles.clientLabel}>CLIENTE</Text>
            <Text style={styles.clientValue}>{comprobante.cliente_nombre}</Text>
          </View>
          <View style={[styles.clientItem, { flex: 0.5 }]}>
            <Text style={styles.clientLabel}>RUC</Text>
            <Text style={styles.clientValue}>{comprobante.cliente_doc}</Text>
          </View>
          <View style={[styles.clientItem, { flex: 0.5 }]}>
            <Text style={styles.clientLabel}>FECHA</Text>
            <Text style={styles.clientValue}>{formatFecha(comprobante.fecha)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>CANT</Text>
            <Text style={styles.col2}>DESCRIPCIÓN</Text>
            <Text style={styles.col3}>P.UNIT (Inc.IGV)</Text>
            <Text style={styles.col4}>TOTAL</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{item.cantidad}</Text>
              <Text style={styles.col2}>{item.descripcion}</Text>
              <Text style={styles.col3}>{formatMonto(item.precio_unitario)}</Text>
              <Text style={styles.col4}>{formatMonto(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Subtotal Gravado</Text>
              <Text>{formatMonto(comprobante.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>IGV (18%)</Text>
              <Text>{formatMonto(comprobante.igv)}</Text>
            </View>
            <View style={styles.totalBold}>
              <Text>TOTAL</Text>
              <Text>{formatMonto(comprobante.total)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {comprobante.qr_data_uri && <Image src={comprobante.qr_data_uri} style={styles.qrBox} />}
          <View style={styles.legalBox}>
            <Text style={styles.legalText}>Representación impresa de la Factura Electrónica</Text>
            <Text style={styles.legalText}>Hash: {comprobante.hash}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
