import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatFecha, formatMonto, registerFonts } from '../shared/helpers'
import { PropsNotaVenta } from './types'

export default function PlantillaNotaVentaCompacta({ emisor, comprobante, items }: PropsNotaVenta) {
  registerFonts()

  const styles = StyleSheet.create({
    page: { width: '58mm', padding: '3mm', fontFamily: 'Roboto', fontSize: 7, color: '#000', backgroundColor: '#fff' },
    
    header: { alignItems: 'center', marginBottom: 6 },
    title: { fontSize: 10, fontWeight: 'bold', marginBottom: 2, textAlign: 'center' },
    subtitle: { fontSize: 7, textAlign: 'center', marginBottom: 1 },
    
    separator: { borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'dashed', marginVertical: 3 },
    
    docInfo: { alignItems: 'center', marginBottom: 3 },
    docType: { fontWeight: 'bold', fontSize: 9 },
    docNum: { fontSize: 8, marginTop: 1 },
    
    clientBox: { marginBottom: 3, gap: 1 },
    clientRow: { flexDirection: 'row' },
    clientBold: { fontWeight: 'bold', marginRight: 2 },
    
    itemsHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 1, marginBottom: 2 },
    itemRow: { flexDirection: 'row', marginBottom: 2 },
    itemQty: { width: '15%' },
    itemDesc: { width: '55%' },
    itemTotal: { width: '30%', textAlign: 'right' },
    
    totalSection: { marginTop: 3, borderTopWidth: 1, borderTopColor: '#000', paddingTop: 3 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
    totalLabel: { fontWeight: 'bold', fontSize: 8 },
    totalValue: { fontWeight: 'bold', fontSize: 8 },
    
    footer: { marginTop: 6, alignItems: 'center' },
    footerTitle: { fontWeight: 'bold', fontSize: 8, marginBottom: 2, marginTop: 2 },
    legalText: { fontSize: 6, color: '#555', textAlign: 'center' }
  })

  return (
    <Document>
      <Page style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{emisor.nombre_comercial}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.docInfo}>
          <Text style={styles.docType}>NOTA DE VENTA</Text>
          <Text style={styles.docNum}>{comprobante.numero_completo}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.clientBox}>
          <Text><Text style={styles.clientBold}>Fecha:</Text> {formatFecha(comprobante.fecha)}</Text>
          <Text><Text style={styles.clientBold}>Cliente:</Text> {comprobante.cliente_nombre}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.itemsHeader}>
          <Text style={[styles.itemQty, { fontWeight: 'bold' }]}>Cant</Text>
          <Text style={[styles.itemDesc, { fontWeight: 'bold' }]}>Desc</Text>
          <Text style={[styles.itemTotal, { fontWeight: 'bold' }]}>Total</Text>
        </View>

        {items.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.cantidad}</Text>
            <Text style={styles.itemDesc}>{item.descripcion}</Text>
            <Text style={styles.itemTotal}>{item.subtotal.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totalSection}>
          <View style={[styles.totalRow, { marginTop: 2 }]}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatMonto(comprobante.total)}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>¡GRACIAS!</Text>
          <Text style={styles.legalText}>Sin validez tributaria.</Text>
        </View>
      </Page>
    </Document>
  )
}
