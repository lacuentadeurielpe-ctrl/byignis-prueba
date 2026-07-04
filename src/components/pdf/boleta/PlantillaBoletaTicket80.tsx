import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatFecha, formatMonto, registerFonts } from '../shared/helpers'
import { PropsBoleta } from './types'

export default function PlantillaBoletaTicket80({ emisor, comprobante, items, tema }: PropsBoleta) {
  registerFonts()

  const styles = StyleSheet.create({
    page: { width: '80mm', padding: '5mm', fontFamily: 'Roboto', fontSize: 9, color: '#000', backgroundColor: '#fff' },
    
    header: { alignItems: 'center', marginBottom: 8 },
    logo: { width: 60, marginBottom: 4, objectFit: 'contain' },
    title: { fontSize: 12, fontWeight: 'bold', marginBottom: 2, textAlign: 'center', color: tema.primario },
    subtitle: { fontSize: 9, textAlign: 'center', marginBottom: 1 },
    
    separator: { borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'dashed', marginVertical: 4 },
    
    docInfo: { alignItems: 'center', marginBottom: 4 },
    docType: { fontWeight: 'bold', fontSize: 11 },
    docNum: { fontSize: 10, marginTop: 2 },
    
    clientBox: { marginBottom: 4, gap: 2 },
    clientRow: { flexDirection: 'row' },
    clientBold: { fontWeight: 'bold', marginRight: 4 },
    
    itemsHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 2, marginBottom: 4 },
    itemRow: { flexDirection: 'row', marginBottom: 2 },
    itemQty: { width: '15%' },
    itemDesc: { width: '60%' },
    itemTotal: { width: '25%', textAlign: 'right' },
    
    totalSection: { marginTop: 4, borderTopWidth: 1, borderTopColor: '#000', paddingTop: 4 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
    totalLabel: { fontWeight: 'bold', fontSize: 10 },
    totalValue: { fontWeight: 'bold', fontSize: 10 },
    
    footer: { marginTop: 8, alignItems: 'center' },
    footerTitle: { fontWeight: 'bold', fontSize: 10, marginBottom: 4, marginTop: 4, color: tema.primario },
    legalText: { fontSize: 8, color: '#555', textAlign: 'center' }
  })

  return (
    <Document>
      <Page style={styles.page}>
        <View style={styles.header}>
          {emisor.logo_url && <Image src={emisor.logo_url} style={styles.logo} />}
          <Text style={styles.title}>{emisor.nombre_comercial}</Text>
          <Text style={styles.subtitle}>{emisor.razon_social}</Text>
          <Text style={styles.subtitle}>{emisor.direccion}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.docInfo}>
          <Text style={styles.docType}>BOLETA DE VENTA</Text>
          <Text style={styles.docNum}>{comprobante.numero_completo}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.clientBox}>
          <Text><Text style={styles.clientBold}>Fecha:</Text> {formatFecha(comprobante.fecha)}</Text>
          <Text><Text style={styles.clientBold}>Cliente:</Text> {comprobante.cliente_nombre}</Text>
          {comprobante.cliente_doc && (
            <Text><Text style={styles.clientBold}>DNI/Doc:</Text> {comprobante.cliente_doc}</Text>
          )}
        </View>

        <View style={styles.separator} />

        <View style={styles.itemsHeader}>
          <Text style={[styles.itemQty, { fontWeight: 'bold' }]}>Cant</Text>
          <Text style={[styles.itemDesc, { fontWeight: 'bold' }]}>DescripciÃ³n</Text>
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
          <View style={styles.totalRow}>
            <Text style={{ fontSize: 9 }}>Op. Gravada</Text>
            <Text style={{ fontSize: 9 }}>{formatMonto(comprobante.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ fontSize: 9 }}>IGV (18%)</Text>
            <Text style={{ fontSize: 9 }}>{formatMonto(comprobante.igv)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 2 }]}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalValue}>{formatMonto(comprobante.total)}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Â¡GRACIAS POR SU COMPRA!</Text>
          <Text style={styles.legalText}>Representaciï¿½n impresa de la Boleta de Venta Electrï¿½nica.</Text>
        </View>
      </Page>
    </Document>
  )
}
