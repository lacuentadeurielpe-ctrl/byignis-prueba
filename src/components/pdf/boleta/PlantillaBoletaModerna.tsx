import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatFecha, formatMonto, registerFonts } from '../shared/helpers'
import { PropsBoleta } from './types'

export default function PlantillaBoletaModerna({ emisor, comprobante, items, tema }: PropsBoleta) {
  registerFonts()

  const styles = StyleSheet.create({
    page: { padding: 0, fontFamily: 'Roboto', fontSize: 10, color: '#333' },
    topBand: { 
      backgroundColor: tema.primario, 
      height: 120, 
      padding: 30,
      flexDirection: 'row',
      justifyContent: 'space-between',
      color: '#fff'
    },
    logo: { width: 140, objectFit: 'contain' },
    topRight: { alignItems: 'flex-end' },
    titleMain: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    titleSub: { fontSize: 12, opacity: 0.9 },
    
    content: { padding: 30 },
    
    infoSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    emisorCol: { width: '45%' },
    clienteCol: { width: '45%' },
    colTitle: { fontSize: 12, fontWeight: 'bold', color: tema.primario, marginBottom: 8 },
    infoLine: { fontSize: 10, marginBottom: 4, color: '#555' },
    infoBold: { fontWeight: 'bold', color: '#333' },
    
    table: { width: '100%', marginBottom: 30 },
    tableHeader: { 
      flexDirection: 'row', 
      borderBottomWidth: 2, 
      borderBottomColor: tema.primario, 
      paddingBottom: 8,
      marginBottom: 8,
      fontWeight: 'bold',
      color: tema.primario
    },
    tableRow: { 
      flexDirection: 'row', 
      borderBottomWidth: 1, 
      borderBottomColor: '#f0f0f0', 
      paddingVertical: 8 
    },
    col1: { width: '15%' },
    col2: { width: '45%' },
    col3: { width: '20%', textAlign: 'right' },
    col4: { width: '20%', textAlign: 'right' },
    
    totalsArea: { flexDirection: 'row', justifyContent: 'flex-end' },
    totalsBox: { width: 220 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    totalFinal: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      paddingVertical: 10,
      marginTop: 5,
      borderTopWidth: 2,
      borderTopColor: tema.secundario,
      fontWeight: 'bold',
      fontSize: 14,
      color: tema.primario
    },
    
    footer: { 
      position: 'absolute', 
      bottom: 30, 
      left: 30, 
      right: 30, 
      flexDirection: 'row', 
      borderTopWidth: 1, 
      borderTopColor: '#eee', 
      paddingTop: 20 
    },
    qrBox: { width: 70, height: 70, marginRight: 20 },
    legalBox: { flex: 1, justifyContent: 'center' },
    legalText: { fontSize: 8, color: '#888', marginBottom: 3 }
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBand}>
          <View>
            {emisor.logo_url ? (
              <Image src={emisor.logo_url} style={styles.logo} />
            ) : (
              <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{emisor.nombre_comercial}</Text>
            )}
          </View>
          <View style={styles.topRight}>
            <Text style={styles.titleMain}>BOLETA</Text>
            <Text style={styles.titleSub}>{comprobante.numero_completo}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.infoSection}>
            <View style={styles.emisorCol}>
              <Text style={styles.colTitle}>De:</Text>
              <Text style={styles.infoLine}><Text style={styles.infoBold}>{emisor.razon_social}</Text></Text>
              <Text style={styles.infoLine}>RUC: {emisor.ruc}</Text>
              <Text style={styles.infoLine}>{emisor.direccion}</Text>
            </View>
            
            <View style={styles.clienteCol}>
              <Text style={styles.colTitle}>Para:</Text>
              <Text style={styles.infoLine}><Text style={styles.infoBold}>{comprobante.cliente_nombre}</Text></Text>
              {comprobante.cliente_doc && (
                <Text style={styles.infoLine}>DNI/Doc: {comprobante.cliente_doc}</Text>
              )}
              <Text style={styles.infoLine}>Fecha: {formatFecha(comprobante.fecha)}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>CANT</Text>
              <Text style={styles.col2}>DESCRIPCIÓN</Text>
              <Text style={styles.col3}>PRECIO</Text>
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

          <View style={styles.totalsArea}>
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={{ color: '#666' }}>Subtotal</Text>
                <Text>{formatMonto(comprobante.subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={{ color: '#666' }}>IGV (18%)</Text>
                <Text>{formatMonto(comprobante.igv)}</Text>
              </View>
              <View style={styles.totalFinal}>
                <Text>TOTAL A PAGAR</Text>
                <Text>{formatMonto(comprobante.total)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {comprobante.qr_data_uri && (
            <Image src={comprobante.qr_data_uri} style={styles.qrBox} />
          )}
          <View style={styles.legalBox}>
            <Text style={styles.legalText}>Boleta de Venta Electrónica. Representación impresa.</Text>
            <Text style={styles.legalText}>Hash: {comprobante.hash}</Text>
            <Text style={styles.legalText}>Consulte este documento en www.sunat.gob.pe</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
