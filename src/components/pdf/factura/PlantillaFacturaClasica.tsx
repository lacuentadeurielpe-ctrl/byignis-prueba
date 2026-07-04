import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatFecha, formatMonto, registerFonts } from '../shared/helpers'
import { PropsFactura } from './types'

export default function PlantillaFacturaClasica({ emisor, comprobante, items, tema }: PropsFactura) {
  registerFonts()

  const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Roboto', fontSize: 10, color: '#222' },
    
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 15 },
    logoBox: { width: 140, marginBottom: 10 },
    logo: { width: '100%', objectFit: 'contain' },
    emisorInfo: { flex: 1, paddingRight: 20 },
    emisorTitle: { fontSize: 14, fontWeight: 'bold', color: tema.primario, marginBottom: 4 },
    emisorText: { fontSize: 9, color: '#555', marginBottom: 2 },
    
    docBox: { width: 220, borderWidth: 1, borderColor: tema.primario, padding: 15, alignItems: 'center' },
    docRuc: { fontSize: 12, fontWeight: 'bold' },
    docType: { fontSize: 14, fontWeight: 'bold', marginVertical: 6, color: tema.primario, textAlign: 'center' },
    docNum: { fontSize: 12 },

    clientBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    clientLeft: { width: '60%' },
    clientRight: { width: '35%' },
    clientRow: { flexDirection: 'row', marginBottom: 4 },
    clientLabel: { width: 70, fontWeight: 'bold', fontSize: 9, color: tema.primario },
    clientValue: { flex: 1, fontSize: 9 },

    table: { width: '100%', marginBottom: 20 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', padding: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ccc' },
    th: { fontWeight: 'bold', fontSize: 9 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', padding: 8, fontSize: 9 },
    col1: { width: '10%' },
    col2: { width: '40%' },
    col3: { width: '15%', textAlign: 'right' },
    col4: { width: '15%', textAlign: 'right' },
    col5: { width: '20%', textAlign: 'right' },

    totalsWrapper: { flexDirection: 'row', justifyContent: 'flex-end' },
    totalsBox: { width: 200 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
    totalFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, backgroundColor: tema.primario, color: '#fff', fontWeight: 'bold' },

    footer: { position: 'absolute', bottom: 30, left: 30, right: 30, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 15 },
    qrBox: { width: 80, height: 80, marginRight: 15 },
    legalBox: { flex: 1, justifyContent: 'center' },
    legalText: { fontSize: 8, color: '#666', marginBottom: 3 }
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.emisorInfo}>
            {emisor.logo_url && <View style={styles.logoBox}><Image src={emisor.logo_url} style={styles.logo} /></View>}
            <Text style={styles.emisorTitle}>{emisor.nombre_comercial}</Text>
            <Text style={styles.emisorText}>{emisor.razon_social}</Text>
            <Text style={styles.emisorText}>{emisor.direccion}</Text>
          </View>
          <View style={styles.docBox}>
            <Text style={styles.docRuc}>RUC {emisor.ruc}</Text>
            <Text style={styles.docType}>FACTURA ELECTRÓNICA</Text>
            <Text style={styles.docNum}>{comprobante.numero_completo}</Text>
          </View>
        </View>

        <View style={styles.clientBox}>
          <View style={styles.clientLeft}>
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Señor(es):</Text>
              <Text style={styles.clientValue}>{comprobante.cliente_nombre}</Text>
            </View>
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>RUC/Doc:</Text>
              <Text style={styles.clientValue}>{comprobante.cliente_doc}</Text>
            </View>
          </View>
          <View style={styles.clientRight}>
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Fecha:</Text>
              <Text style={styles.clientValue}>{formatFecha(comprobante.fecha)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, styles.th]}>CANT</Text>
            <Text style={[styles.col2, styles.th]}>DESCRIPCIÓN</Text>
            <Text style={[styles.col3, styles.th]}>V. UNIT</Text>
            <Text style={[styles.col4, styles.th]}>IGV</Text>
            <Text style={[styles.col5, styles.th]}>TOTAL</Text>
          </View>
          {items.map((item, i) => {
            const vUnit = item.precio_unitario / 1.18
            const sub = item.subtotal / 1.18
            const igv = item.subtotal - sub
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{item.cantidad}</Text>
                <Text style={styles.col2}>{item.descripcion}</Text>
                <Text style={styles.col3}>{formatMonto(vUnit)}</Text>
                <Text style={styles.col4}>{formatMonto(igv)}</Text>
                <Text style={styles.col5}>{formatMonto(item.subtotal)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totalsWrapper}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Op. Gravada:</Text>
              <Text>{formatMonto(comprobante.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>IGV (18%):</Text>
              <Text>{formatMonto(comprobante.igv)}</Text>
            </View>
            <View style={styles.totalFinal}>
              <Text>TOTAL:</Text>
              <Text>{formatMonto(comprobante.total)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {comprobante.qr_data_uri && <Image src={comprobante.qr_data_uri} style={styles.qrBox} />}
          <View style={styles.legalBox}>
            <Text style={styles.legalText}>Representación impresa de la Factura Electrónica.</Text>
            <Text style={styles.legalText}>Hash: {comprobante.hash}</Text>
            <Text style={styles.legalText}>Consulte su documento en www.sunat.gob.pe</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
