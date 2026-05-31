// Componente React PDF para comprobantes y órdenes de compra
// Usa @react-pdf/renderer — corre solo server-side

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ItemComprobante {
  nombre_producto: string
  unidad: string
  cantidad: number
  precio_unitario: number // actúa como costo_unitario en órdenes de compra
  subtotal: number
}

export interface DatosComprobante {
  // Ferretería
  nombre_ferreteria: string
  direccion_ferreteria: string | null
  telefono_ferreteria: string
  logo_url: string | null
  color: string          // hex — default '#1e40af'
  mensaje_pie: string | null

  // Comprobante
  numero_comprobante: string    // CP-000001 o OC-000001
  fecha_emision: string         // ISO string
  esProforma?: boolean          // true = documento pendiente de confirmación / proforma
  esOrdenCompra?: boolean       // true = orden de compra a proveedor

  // Pedido / Orden
  numero_pedido?: string
  nombre_cliente?: string       // o nombre del proveedor si es orden de compra
  modalidad?: 'delivery' | 'recojo'
  direccion_entrega?: string | null
  formas_pago?: string[]

  // Proveedor específico (para orden de compra)
  proveedor_contacto?: string | null
  proveedor_telefono?: string | null

  // Items
  items: ItemComprobante[]
  total: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPEN(n: number): string {
  return `S/ ${n.toFixed(2)}`
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// ── Estilos (Diseño Premium) ──────────────────────────────────────────────────

function crearEstilos(color: string) {
  // Un color más oscuro para usarlo en textos sobre el color principal
  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: '#334155', // slate-700
      backgroundColor: '#ffffff',
      paddingTop: 45,
      paddingBottom: 45,
      paddingHorizontal: 50,
    },
    // Header
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 35,
    },
    logoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    logoImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 16,
      objectFit: 'cover',
    },
    logoTextFallback: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: '#f8fafc', // slate-50
      marginRight: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#e2e8f0', // slate-200
    },
    logoText: {
      color: color,
      fontSize: 22,
      fontFamily: 'Helvetica-Bold',
    },
    companyInfo: {
      justifyContent: 'center',
      flex: 1,
      paddingRight: 20,
    },
    companyName: {
      fontSize: 18,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a', // slate-900
      marginBottom: 6,
      letterSpacing: -0.5,
    },
    companyDetails: {
      fontSize: 9,
      color: '#64748b', // slate-500
      lineHeight: 1.4,
    },
    documentInfoBox: {
      alignItems: 'flex-end',
    },
    documentType: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: color,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    documentNumber: {
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      color: '#475569', // slate-600
      marginBottom: 8,
    },
    documentDate: {
      fontSize: 9,
      color: '#94a3b8', // slate-400
    },
    
    // Parties Section (Cliente / Proveedor)
    partiesContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 35,
    },
    partyBox: {
      width: '100%',
      backgroundColor: '#f8fafc',
      padding: 14,
      borderRadius: 6,
      borderLeftWidth: 4,
      borderLeftColor: color,
    },
    partyBoxHalf: {
      width: '48%',
      backgroundColor: '#f8fafc',
      padding: 14,
      borderRadius: 6,
      borderLeftWidth: 4,
      borderLeftColor: color,
    },
    partyTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    partyName: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
      marginBottom: 8,
    },
    partyDetailRow: {
      flexDirection: 'row',
      marginBottom: 5,
    },
    partyDetailLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#64748b',
      width: 75,
    },
    partyDetailValue: {
      fontSize: 9,
      color: '#334155',
      flex: 1,
      lineHeight: 1.3,
    },

    // Table
    table: {
      marginBottom: 25,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: color,
      borderRadius: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 4,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
    },
    tableRowAlt: {
      backgroundColor: '#fcfcfd',
    },
    thBase: { color: '#ffffff', fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    tdBase: { fontSize: 9, color: '#334155' },
    
    colCant: { width: '10%', textAlign: 'center' },
    colDesc: { flex: 1, textAlign: 'left', paddingRight: 10 },
    colUnid: { width: '12%', textAlign: 'center' },
    colPrecio: { width: '18%', textAlign: 'right' },
    colSubtot: { width: '18%', textAlign: 'right' },
    
    tdDescVal: { fontFamily: 'Helvetica-Bold', color: '#0f172a', fontSize: 9 },
    tdSubtotVal: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },

    // Totals
    totalsContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 40,
    },
    totalsBox: {
      width: '50%',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
    },
    totalRowLast: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      marginTop: 6,
      backgroundColor: '#f8fafc',
      borderRadius: 6,
      paddingHorizontal: 14,
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 10,
      color: '#64748b',
    },
    totalValue: {
      fontSize: 10,
      color: '#334155',
      fontFamily: 'Helvetica-Bold',
    },
    totalFinalLabel: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalFinalValue: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: color,
    },

    // Footer
    footer: {
      marginTop: 'auto',
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      paddingTop: 20,
    },
    footerInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    footerNotesBox: {
      width: '60%',
    },
    footerNotesTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#94a3b8',
      textTransform: 'uppercase',
      marginBottom: 6,
      letterSpacing: 1,
    },
    footerNotesText: {
      fontSize: 8.5,
      color: '#475569',
      lineHeight: 1.5,
    },
    footerThanks: {
      width: '35%',
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    footerThanksText: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: color,
      marginBottom: 4,
      textAlign: 'right',
    },
    footerDisclaimer: {
      fontSize: 7,
      color: '#94a3b8',
      textAlign: 'center',
      lineHeight: 1.4,
    },
  })
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ComprobantePDF({ datos }: { datos: DatosComprobante }) {
  const S = crearEstilos(datos.color)

  const subtotalItems = datos.items.reduce((s, i) => s + i.subtotal, 0)
  const hayDescuento = Math.abs(subtotalItems - datos.total) > 0.005

  const formasPagoTexto = datos.formas_pago && datos.formas_pago.length > 0
    ? datos.formas_pago.join(', ')
    : 'A convenir'

  // Determinar etiquetas de acuerdo al tipo de documento
  const esCompra = datos.esOrdenCompra === true
  let docTitulo = 'COMPROBANTE INTERNO'
  if (esCompra) {
    docTitulo = datos.esProforma ? 'PROFORMA DE COMPRA' : 'ORDEN DE COMPRA'
  } else if (datos.esProforma) {
    docTitulo = 'COTIZACIÓN / PROFORMA'
  }

  return (
    <Document
      title={`${docTitulo} ${datos.numero_comprobante} — ${datos.nombre_ferreteria}`}
      author={datos.nombre_ferreteria}
    >
      <Page size="A4" style={S.page}>

        {/* ── CABECERA ── */}
        <View style={S.headerContainer}>
          <View style={S.logoSection}>
            {datos.logo_url ? (
              <Image src={datos.logo_url} style={S.logoImage} />
            ) : (
              <View style={S.logoTextFallback}>
                <Text style={S.logoText}>{iniciales(datos.nombre_ferreteria)}</Text>
              </View>
            )}
            <View style={S.companyInfo}>
              <Text style={S.companyName}>{datos.nombre_ferreteria}</Text>
              {datos.direccion_ferreteria && (
                <Text style={S.companyDetails}>{datos.direccion_ferreteria}</Text>
              )}
              <Text style={S.companyDetails}>WhatsApp: {datos.telefono_ferreteria}</Text>
            </View>
          </View>

          <View style={S.documentInfoBox}>
            <Text style={S.documentType}>{docTitulo}</Text>
            <Text style={S.documentNumber}>Nº {datos.numero_comprobante}</Text>
            <Text style={S.documentDate}>Emitido el {formatFechaHora(datos.fecha_emision)}</Text>
          </View>
        </View>

        {/* ── PARTES (CLIENTE/PROVEEDOR) ── */}
        <View style={S.partiesContainer}>
          {/* Box Principal (Cliente o Proveedor) */}
          <View style={!esCompra && !datos.numero_pedido && datos.modalidad !== 'delivery' ? S.partyBox : S.partyBoxHalf}>
            <Text style={S.partyTitle}>{esCompra ? 'Proveedor' : 'Cliente'}</Text>
            <Text style={S.partyName}>{datos.nombre_cliente ?? '—'}</Text>
            
            {esCompra && datos.proveedor_contacto && (
              <View style={S.partyDetailRow}>
                <Text style={S.partyDetailLabel}>Contacto:</Text>
                <Text style={S.partyDetailValue}>{datos.proveedor_contacto}</Text>
              </View>
            )}
            {esCompra && datos.proveedor_telefono && (
              <View style={S.partyDetailRow}>
                <Text style={S.partyDetailLabel}>Teléfono:</Text>
                <Text style={S.partyDetailValue}>{datos.proveedor_telefono}</Text>
              </View>
            )}
            {!esCompra && datos.numero_pedido && (
              <View style={S.partyDetailRow}>
                <Text style={S.partyDetailLabel}>Ref. Pedido:</Text>
                <Text style={S.partyDetailValue}>{datos.numero_pedido}</Text>
              </View>
            )}
          </View>

          {/* Box Secundario (Direcciones / Entregas) */}
          {(!(!esCompra && !datos.numero_pedido && datos.modalidad !== 'delivery')) && (
            <View style={S.partyBoxHalf}>
              <Text style={S.partyTitle}>{esCompra ? 'Lugar de Entrega' : 'Condiciones de Entrega'}</Text>
              
              {esCompra ? (
                <>
                  <Text style={S.partyName}>Almacén de Tienda</Text>
                  <View style={S.partyDetailRow}>
                    <Text style={S.partyDetailLabel}>Dirección:</Text>
                    <Text style={S.partyDetailValue}>
                      {datos.direccion_ferreteria || 'Misma dirección de la empresa'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={S.partyName}>
                    {datos.modalidad === 'delivery' ? 'Envío a domicilio' : 'Recojo en tienda'}
                  </Text>
                  {datos.modalidad === 'delivery' && datos.direccion_entrega && (
                    <View style={S.partyDetailRow}>
                      <Text style={S.partyDetailLabel}>Dirección:</Text>
                      <Text style={S.partyDetailValue}>{datos.direccion_entrega}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* ── TABLA DE PRODUCTOS ── */}
        <View style={S.table}>
          {/* Header */}
          <View style={S.tableHeader}>
            <Text style={[S.thBase, S.colCant]}>Cant.</Text>
            <Text style={[S.thBase, S.colDesc]}>Descripción</Text>
            <Text style={[S.thBase, S.colUnid]}>Medida</Text>
            <Text style={[S.thBase, S.colPrecio]}>{esCompra ? 'Costo U.' : 'Precio U.'}</Text>
            <Text style={[S.thBase, S.colSubtot]}>Subtotal</Text>
          </View>
          {/* Filas */}
          {datos.items.map((item, idx) => (
            <View
              key={idx}
              style={[S.tableRow, idx % 2 === 1 ? S.tableRowAlt : {}]}
            >
              <Text style={[S.tdBase, S.colCant]}>{item.cantidad}</Text>
              <Text style={[S.tdBase, S.colDesc, S.tdDescVal]}>{item.nombre_producto}</Text>
              <Text style={[S.tdBase, S.colUnid]}>{item.unidad}</Text>
              <Text style={[S.tdBase, S.colPrecio]}>{formatPEN(item.precio_unitario)}</Text>
              <Text style={[S.tdBase, S.colSubtot, S.tdSubtotVal]}>{formatPEN(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* ── TOTALES ── */}
        <View style={S.totalsContainer}>
          <View style={S.totalsBox}>
            {hayDescuento && (
              <>
                <View style={S.totalRow}>
                  <Text style={S.totalLabel}>Subtotal bruto</Text>
                  <Text style={S.totalValue}>{formatPEN(subtotalItems)}</Text>
                </View>
                <View style={S.totalRow}>
                  <Text style={S.totalLabel}>Descuento aplicado</Text>
                  <Text style={{ ...S.totalValue, color: '#10b981' }}>
                    − {formatPEN(subtotalItems - datos.total)}
                  </Text>
                </View>
              </>
            )}
            <View style={S.totalRowLast}>
              <Text style={S.totalFinalLabel}>
                {esCompra ? 'TOTAL ORDEN' : 'TOTAL A PAGAR'}
              </Text>
              <Text style={S.totalFinalValue}>{formatPEN(datos.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── PIE DE PÁGINA ── */}
        <View style={S.footer}>
          <View style={S.footerInfo}>
            <View style={S.footerNotesBox}>
              <Text style={S.footerNotesTitle}>
                {esCompra ? 'Condiciones Adicionales' : 'Métodos de Pago / Notas'}
              </Text>
              <Text style={S.footerNotesText}>
                {esCompra 
                  ? 'Por favor, confirmar la recepción de esta orden y el tiempo estimado de entrega. En caso de variaciones de stock o precio, notificar previo al despacho.'
                  : `Formas de pago aceptadas: ${formasPagoTexto}. ${datos.mensaje_pie || ''}`
                }
              </Text>
            </View>
            <View style={S.footerThanks}>
              <Text style={S.footerThanksText}>
                {esCompra
                  ? 'Esperamos su despacho'
                  : (datos.esProforma ? '¡Gracias por su interés!' : '¡Gracias por su preferencia!')}
              </Text>
            </View>
          </View>

          <Text style={S.footerDisclaimer}>
            {esCompra
              ? `Este documento es una orden de compra emitida de manera interna por ${datos.nombre_ferreteria} y dirigida al proveedor para fines de abastecimiento. No constituye un comprobante de venta electrónica ni tiene validez tributaria ante la SUNAT.`
              : (datos.esProforma
                  ? `Este documento es una cotización emitida de manera virtual por ${datos.nombre_ferreteria}. Tiene un propósito estrictamente informativo sobre precios y disponibilidad de stock, y no constituye un comprobante de pago de carácter tributario.`
                  : `Este documento es un comprobante de control interno emitido por ${datos.nombre_ferreteria}. No posee validez tributaria ante la SUNAT ni reemplaza a una boleta o factura de venta electrónica.`)}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
