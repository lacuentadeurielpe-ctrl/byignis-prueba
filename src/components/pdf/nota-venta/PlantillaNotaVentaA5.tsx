import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatFecha, formatMonto, registerFonts } from '../shared/helpers'
import { PropsNotaVenta } from './types'

export default function PlantillaNotaVentaA5({ emisor, comprobante, items, tema }: PropsNotaVenta) {
  registerFonts()

  const styles = StyleSheet.create({
    page: { padding: 20, fontFamily: 'Roboto', fontSize: 10, color: '#333' },
    
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: tema.primario, padding: 15, borderRadius: 8, color: '#fff' },
    logoBox: { width: 80, height: 80, backgroundColor: '#fff', borderRadius: 4, padding: 5, marginRight: 15, justifyContent: 'center' },
    logo: { width: '100%', height: '100%', objectFit: 'contain' },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: 'bold' },
    emisorText: { fontSize: 9, opacity: 0.9 },
    
    docBox: { alignItems: 'flex-end', width: 120 },
    docType: { fontSize: 12, fontWeight: 'bold' },
    docNum: { fontSize: 14, fontWeight: 'bold' },

    clientRow: { flexDirection: 'row', marginBottom: 15, borderLeftWidth: 3, borderLeftColor: tema.secundario, paddingLeft: 10 },
    clientItem: { flex: 1 },
    clientLabel: { fontSize: 8, color: '#666', fontWeight: 'bold', textTransform: 'uppercase' },
    clientValue: { fontSize: 10, fontWeight: 'bold', color: '#111' },

    table: { width: '100%', marginBottom: 15 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: tema.primario, paddingBottom: 6, marginBottom: 6, fontWeight: 'bold', color: tema.primario },
    tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    col1: { width: '10%' },
    col2: { width: '50%' },
    col3: { width: '20%', textAlign: 'right' },
    col4: { width: '20%', textAlign: 'right' },

    totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
    totalsBox: { width: 180, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: tema.primario },
    totalBold: { flexDirection: 'row', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14, color: tema.primario },

    footer: { position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
    legalText: { fontSize: 8, color: '#888', fontStyle: 'italic' },
    gracias: { fontSize: 12, fontWeight: 'bold', color: tema.secundario, marginBottom: 2 }
  })

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.headerRow}>
          {emisor.logo_url && (
            <View style={styles.logoBox}>
              <Image src={emisor.logo_url} style={styles.logo} />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{emisor.nombre_comercial}</Text>
            <Text style={styles.emisorText}>{emisor.direccion}</Text>
            <Text style={styles.emisorText}>Tel: {emisor.ruc}</Text>
          </View>
          <View style={styles.docBox}>
            <Text style={styles.docType}>NOTA DE VENTA</Text>
            <Text style={styles.docNum}>{comprobante.numero_completo}</Text>
          </View>
        </View>

        <View style={styles.clientRow}>
          <View style={styles.clientItem}>
            <Text style={styles.clientLabel}>Cliente</Text>
            <Text style={styles.clientValue}>{comprobante.cliente_nombre}</Text>
          </View>
          {comprobante.cliente_doc && (
            <View style={[styles.clientItem, { flex: 0.5 }]}>
              <Text style={styles.clientLabel}>Doc.</Text>
              <Text style={styles.clientValue}>{comprobante.cliente_doc}</Text>
            </View>
          )}
          <View style={[styles.clientItem, { flex: 0.5 }]}>
            <Text style={styles.clientLabel}>Fecha</Text>
            <Text style={styles.clientValue}>{formatFecha(comprobante.fecha)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>CANT</Text>
            <Text style={styles.col2}>DESCRIPCIÓN</Text>
            <Text style={styles.col3}>P.UNIT</Text>
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
            <View style={styles.totalBold}>
              <Text>TOTAL</Text>
              <Text>{formatMonto(comprobante.total)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.gracias}>¡Gracias por su preferencia!</Text>
          <Text style={styles.legalText}>Este documento es de control interno y no tiene validez tributaria.</Text>
        </View>
      </Page>
    </Document>
  )
}
