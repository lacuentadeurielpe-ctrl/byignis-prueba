import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image as PdfImage } from '@react-pdf/renderer'
import { formatPEN } from '../utils' // Asumiendo que utils está accesible o usaré formato básico

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2' },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 700 }
  ]
})

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Inter', fontSize: 10, color: '#18181b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  logo: { width: 120, maxHeight: 60, objectFit: 'contain' },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 700, color: '#18181b', marginBottom: 4 },
  documentNumber: { fontSize: 12, color: '#71717a', fontWeight: 700 },
  infoSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, backgroundColor: '#fafafa', padding: 15, borderRadius: 8 },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: 8, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { fontSize: 10, fontWeight: 700, color: '#18181b', marginBottom: 2 },
  infoValueLight: { fontSize: 9, color: '#52525b' },
  table: { width: '100%', marginBottom: 30 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4e4e7', paddingBottom: 6, marginBottom: 8 },
  thDesc: { flex: 3, fontSize: 9, color: '#71717a', fontWeight: 700 },
  thMarca: { flex: 1.5, fontSize: 9, color: '#71717a', fontWeight: 700 },
  thCant: { flex: 1, fontSize: 9, color: '#71717a', fontWeight: 700, textAlign: 'center' },
  thUnit: { flex: 1, fontSize: 9, color: '#71717a', fontWeight: 700, textAlign: 'right' },
  thTotal: { flex: 1.2, fontSize: 9, color: '#71717a', fontWeight: 700, textAlign: 'right' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f4f4f5', paddingVertical: 8 },
  tdDesc: { flex: 3, fontSize: 9, paddingRight: 8 },
  tdMarca: { flex: 1.5, fontSize: 9, color: '#52525b' },
  tdCant: { flex: 1, fontSize: 9, textAlign: 'center', fontWeight: 700 },
  tdUnit: { flex: 1, fontSize: 9, textAlign: 'right', color: '#52525b' },
  tdTotal: { flex: 1.2, fontSize: 9, textAlign: 'right', fontWeight: 700 },
  totals: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totalsBox: { width: 200, backgroundColor: '#fafafa', padding: 12, borderRadius: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12, fontWeight: 700, color: '#18181b' },
  totalValue: { fontSize: 14, fontWeight: 700, color: '#18181b' },
  notes: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#e4e4e7', paddingTop: 15 },
  notesTitle: { fontSize: 9, fontWeight: 700, color: '#71717a', marginBottom: 4 },
  notesText: { fontSize: 9, color: '#52525b', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#a1a1aa', fontSize: 8, borderTopWidth: 1, borderTopColor: '#f4f4f5', paddingTop: 10 }
})

export interface OrdenCompraPDFProps {
  datos: {
    nombre_ferreteria: string
    direccion_ferreteria: string | null
    telefono_ferreteria: string | null
    logo_url: string | null
    numero_orden: string
    proveedor: string
    fecha_emision: string
    estado: string
    notas: string | null
    items: {
      nombre_producto: string
      marca: string | null
      unidad: string
      cantidad: number
      precio_unitario: number
      subtotal: number
    }[]
    costo_total: number
  }
}

export function OrdenCompraPDF({ datos }: OrdenCompraPDFProps) {
  const formatoMoneda = (val: number) => `S/ ${val.toFixed(2)}`
  const fecha = new Date(datos.fecha_emision).toLocaleDateString('es-PE')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            {datos.logo_url ? (
              <PdfImage src={datos.logo_url} style={styles.logo} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: 700, color: '#18181b', marginBottom: 4 }}>
                {datos.nombre_ferreteria}
              </Text>
            )}
            <Text style={{ fontSize: 9, color: '#71717a', marginTop: 4, maxWidth: 200 }}>
              {datos.direccion_ferreteria || ''}
            </Text>
            {datos.telefono_ferreteria && (
              <Text style={{ fontSize: 9, color: '#71717a', marginTop: 2 }}>
                Telf: {datos.telefono_ferreteria}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>ORDEN DE COMPRA</Text>
            <Text style={styles.documentNumber}>{datos.numero_orden}</Text>
          </View>
        </View>

        {/* Información de Proveedor y Emisión */}
        <View style={styles.infoSection}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Dirigido a (Proveedor)</Text>
            <Text style={styles.infoValue}>{datos.proveedor}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Fecha de Emisión</Text>
            <Text style={styles.infoValue}>{fecha}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Estado</Text>
            <Text style={styles.infoValue}>{datos.estado.toUpperCase()}</Text>
          </View>
        </View>

        {/* Tabla de Productos */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.thDesc}>PRODUCTO</Text>
            <Text style={styles.thMarca}>MARCA</Text>
            <Text style={styles.thCant}>CANT.</Text>
            <Text style={styles.thUnit}>P. UNITARIO</Text>
            <Text style={styles.thTotal}>SUBTOTAL</Text>
          </View>
          
          {datos.items.map((item, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.tdDesc}>{item.nombre_producto} {item.unidad ? `(${item.unidad})` : ''}</Text>
              <Text style={styles.tdMarca}>{item.marca || '-'}</Text>
              <Text style={styles.tdCant}>{item.cantidad}</Text>
              <Text style={styles.tdUnit}>{formatoMoneda(item.precio_unitario)}</Text>
              <Text style={styles.tdTotal}>{formatoMoneda(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totales */}
        <View style={styles.totals} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>COSTO TOTAL EST.</Text>
              <Text style={styles.totalValue}>{formatoMoneda(datos.costo_total)}</Text>
            </View>
          </View>
        </View>

        {/* Notas u Observaciones */}
        {datos.notas && (
          <View style={styles.notes} wrap={false}>
            <Text style={styles.notesTitle}>NOTAS / OBSERVACIONES:</Text>
            <Text style={styles.notesText}>{datos.notas}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Generado automáticamente por el Sistema Integral de {datos.nombre_ferreteria}
        </Text>
      </Page>
    </Document>
  )
}
