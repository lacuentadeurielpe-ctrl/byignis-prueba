import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatFecha, formatMonto, registerFonts } from '../shared/helpers'
import { PropsNotaVenta } from './types'

export default function PlantillaNotaVentaA4({ emisor, comprobante, items, tema }: PropsNotaVenta) {
  registerFonts()

  const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Roboto', fontSize: 10, color: '#333' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    headerLeft: { flex: 1, paddingRight: 20 },
    headerRight: { 
      width: 200, 
      borderWidth: 1, 
      borderColor: tema.primario, 
      borderRadius: 5, 
      padding: 10, 
      alignItems: 'center',
      justifyContent: 'center' 
    },
    logo: { width: 120, marginBottom: 10, objectFit: 'contain' },
    titleBox: { fontSize: 14, fontWeight: 'bold', color: tema.primario, marginBottom: 5 },
    razonSocial: { fontSize: 12, fontWeight: 'bold', marginBottom: 3 },
    infoText: { fontSize: 9, color: '#555', marginBottom: 2 },
    
    clientBox: { 
      borderWidth: 1, 
      borderColor: '#ddd', 
      borderRadius: 5, 
      padding: 10, 
      marginBottom: 20,
      backgroundColor: '#f9f9f9'
    },
    clientRow: { flexDirection: 'row', marginBottom: 4 },
    clientLabel: { width: 60, fontWeight: 'bold' },
    clientValue: { flex: 1 },
    
    table: { width: '100%', marginBottom: 20 },
    tableHeader: { 
      flexDirection: 'row', 
      backgroundColor: tema.primario, 
      color: '#fff', 
      padding: 8,
      fontWeight: 'bold',
      fontSize: 9
    },
    tableRow: { 
      flexDirection: 'row', 
      borderBottomWidth: 1, 
      borderBottomColor: '#eee', 
      padding: 8,
      fontSize: 9
    },
    col1: { width: '15%' },
    col2: { width: '45%' },
    col3: { width: '20%', textAlign: 'right' },
    col4: { width: '20%', textAlign: 'right' },
    
    totalsBox: { 
      width: 200, 
      alignSelf: 'flex-end', 
      borderWidth: 1, 
      borderColor: '#ddd',
      borderRadius: 5,
      marginBottom: 20
    },
    totalRow: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      padding: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#eee'
    },
    totalFinal: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      padding: 8,
      backgroundColor: tema.primario,
      color: '#fff',
      fontWeight: 'bold'
    },
    
    footer: { flexDirection: 'row', marginTop: 'auto', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
    qrBox: { width: 80, height: 80, marginRight: 15 },
    legalBox: { flex: 1, justifyContent: 'center' },
    legalText: { fontSize: 8, color: '#666', marginBottom: 2 }
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {emisor.logo_url && <Image src={emisor.logo_url} style={styles.logo} />}
            <Text style={styles.razonSocial}>{emisor.nombre_comercial}</Text>
            <Text style={styles.infoText}>{emisor.razon_social}</Text>
            <Text style={styles.infoText}>{emisor.direccion}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.titleBox}>RUC: {emisor.ruc}</Text>
            <Text style={styles.titleBox}>NOTA DE VENTA</Text>
            <Text style={styles.titleBox}>ELECTRÃ“NICA</Text>
            <Text style={{ fontSize: 12, marginTop: 5 }}>{comprobante.numero_completo}</Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.clientBox}>
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>Fecha:</Text>
            <Text style={styles.clientValue}>{formatFecha(comprobante.fecha)}</Text>
          </View>
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>Cliente:</Text>
            <Text style={styles.clientValue}>{comprobante.cliente_nombre}</Text>
          </View>
          {comprobante.cliente_doc && (
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>DNI/Doc:</Text>
              <Text style={styles.clientValue}>{comprobante.cliente_doc}</Text>
            </View>
          )}
        </View>

        {/* Tabla */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>CANT.</Text>
            <Text style={styles.col2}>DESCRIPCIÃ“N</Text>
            <Text style={styles.col3}>P. UNITARIO</Text>
            <Text style={styles.col4}>SUBTOTAL</Text>
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

        {/* Totales */}
                <View style={styles.totalsBox}>
          <View style={styles.totalFinal}>
            <Text>TOTAL:</Text>
            <Text>{formatMonto(comprobante.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {comprobante.qr_data_uri && (
            <Image src={comprobante.qr_data_uri} style={styles.qrBox} />
          )}
          <View style={styles.legalBox}>
            <Text style={styles.legalText}>RepresentaciÃ³n impresa de la NOTA DE VENTA ElectrÃ³nica.</Text>
            <Text style={styles.legalText}>Hash: {comprobante.hash}</Text>
            <Text style={styles.legalText}>Consulte su documento en www.sunat.gob.pe</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
