export function generarPLE81Compras(compras: any[], periodoYYYYMM: string): string {
  // PLE 8.1 - Registro de Compras (41 columnas separadas por pipe '|')
  let txt = ''
  
  compras.forEach((compra, i) => {
    const correlativo = String(i + 1).padStart(4, '0')
    const periodo = `${periodoYYYYMM}00`
    
    // Parsear fecha (DD/MM/YYYY)
    const d = new Date(compra.fecha_factura)
    const fechaDDMMYYYY = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
    
    // Tipo documento (01=Factura, 03=Boleta, 00=Otros)
    let tipoDoc = '00'
    let serie = ''
    let numero = ''
    
    if (compra.numero_factura) {
      const parts = compra.numero_factura.split('-')
      if (parts.length === 2) {
        serie = parts[0]
        numero = parts[1]
      } else {
        numero = compra.numero_factura
      }
      
      // Inferir por la serie (F=Factura, B=Boleta)
      if (serie.startsWith('F')) tipoDoc = '01'
      else if (serie.startsWith('B')) tipoDoc = '03'
      else tipoDoc = compra.tipo === 'formal' ? '01' : '00'
    } else {
      tipoDoc = compra.tipo === 'formal' ? '01' : '00'
      serie = '0000'
      numero = '00000000'
    }

    const ruc = compra.ruc_proveedor || ''
    // Tipo doc proveedor: 6=RUC, 1=DNI, 0=Otros
    const tipoDocProv = ruc.length === 11 ? '6' : ruc.length === 8 ? '1' : '0'
    
    const baseImponible = Number(compra.total_bruto || 0).toFixed(2)
    const igv = Number(compra.igv || 0).toFixed(2)
    const total = Number(compra.total_neto || 0).toFixed(2)

    // 41 columnas
    const fila = [
      periodo,                            // 1. Periodo
      `CUO${correlativo}`,                // 2. CUO
      `M${correlativo}`,                  // 3. Correlativo del Asiento
      fechaDDMMYYYY,                      // 4. Fecha de Emisión
      '',                                 // 5. Fecha de Vencimiento
      tipoDoc,                            // 6. Tipo Comprobante
      serie,                              // 7. Serie
      '',                                 // 8. Año Emisión DUA
      numero,                             // 9. Número
      '',                                 // 10. Operaciones sin derecho a CF
      tipoDocProv,                        // 11. Tipo Doc Proveedor
      ruc,                                // 12. Nro Doc Proveedor
      compra.proveedor_nombre?.replace(/\|/g, '') || 'SIN NOMBRE', // 13. Razón Social
      baseImponible,                      // 14. Base Imponible Gravada
      igv,                                // 15. IGV
      '0.00',                             // 16. Base Imponible Mixta
      '0.00',                             // 17. IGV Mixto
      '0.00',                             // 18. Base Imponible No Gravada
      '0.00',                             // 19. IGV No Gravado
      '0.00',                             // 20. Adquisiciones No Gravadas
      '0.00',                             // 21. ISC
      '0.00',                             // 22. Otros Tributos
      total,                              // 23. Importe Total
      '',                                 // 24. Moneda
      '1.000',                            // 25. Tipo de Cambio
      '', '', '', '', '',                 // 26-30. Referencia doc modificado
      '',                                 // 31. Fecha Constancia Detracción
      '',                                 // 32. Número Constancia Detracción
      '',                                 // 33. Marca de Retención
      '',                                 // 34. Clasificación Bienes/Servicios
      '',                                 // 35. Identificación Contrato
      '',                                 // 36. Error T1
      '',                                 // 37. Error T2
      '',                                 // 38. Error T3
      '',                                 // 39. Error T4
      '',                                 // 40. Indicador Comprobantes de Pago Cancelados
      '1'                                 // 41. Estado (1=mes en curso)
    ]
    
    txt += fila.join('|') + '|\r\n'
  })
  
  return txt
}
