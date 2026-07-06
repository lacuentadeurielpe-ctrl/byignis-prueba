// Única fuente de verdad para los catálogos SUNAT usados en notas de
// crédito/débito y guías de remisión. Prohibido duplicar estos arrays en
// componentes — todo lector (UI, mappers, validaciones) importa de aquí.

export interface CatalogoItem {
  codigo: string
  etiqueta: string       // corta, para el selector
  descripcion: string    // texto largo que SUNAT exige como "desMotivo"
  hint?: string          // ayuda contextual bajo el selector en la UI
  grupo: string          // agrupación visual en el selector
  /** Cómo debe comportarse el formulario ante este motivo. */
  comportamiento: 'items' | 'monto_directo' | 'documento_completo'
}

// ── Catálogo 09 — Tipo de Nota de Crédito ─────────────────────────────────────
export const CATALOGO_09_NOTA_CREDITO: CatalogoItem[] = [
  { codigo: '01', etiqueta: 'Anulación de la operación', descripcion: 'Anulación de la operación', grupo: 'Anulación', comportamiento: 'documento_completo', hint: 'Anula el comprobante completo. No permite devolución parcial.' },
  { codigo: '02', etiqueta: 'Anulación por error en el RUC', descripcion: 'Anulación por error en el RUC', grupo: 'Anulación', comportamiento: 'documento_completo', hint: 'El RUC/DNI del cliente estaba mal en el comprobante original.' },
  { codigo: '03', etiqueta: 'Corrección por error en la descripción', descripcion: 'Corrección por error en la descripción', grupo: 'Corrección', comportamiento: 'documento_completo', hint: 'La descripción de un ítem estaba mal escrita.' },
  { codigo: '04', etiqueta: 'Descuento global', descripcion: 'Descuento global', grupo: 'Descuentos', comportamiento: 'monto_directo', hint: 'Descuento aplicado sobre el total, no sobre un ítem específico.' },
  { codigo: '05', etiqueta: 'Descuento por ítem', descripcion: 'Descuento por ítem', grupo: 'Descuentos', comportamiento: 'monto_directo', hint: 'Descuento aplicado a uno o más ítems puntuales.' },
  { codigo: '06', etiqueta: 'Devolución total', descripcion: 'Devolución total', grupo: 'Devolución', comportamiento: 'items', hint: 'El cliente devuelve todos los productos del comprobante.' },
  { codigo: '07', etiqueta: 'Devolución por ítem', descripcion: 'Devolución por ítem', grupo: 'Devolución', comportamiento: 'items', hint: 'El cliente devuelve solo algunos productos — selecciona cuáles.' },
  { codigo: '08', etiqueta: 'Bonificación', descripcion: 'Bonificación', grupo: 'Ajustes', comportamiento: 'monto_directo', hint: 'Se otorga un valor adicional sin cobro, a modo de compensación.' },
  { codigo: '09', etiqueta: 'Disminución en el valor', descripcion: 'Disminución en el valor', grupo: 'Ajustes', comportamiento: 'monto_directo', hint: 'El valor pactado bajó después de emitido el comprobante.' },
  { codigo: '10', etiqueta: 'Otros conceptos', descripcion: 'Otros Conceptos', grupo: 'Ajustes', comportamiento: 'monto_directo' },
  { codigo: '11', etiqueta: 'Ajustes de operaciones de exportación', descripcion: 'Ajustes de operaciones de exportación', grupo: 'Ajustes', comportamiento: 'monto_directo' },
  { codigo: '12', etiqueta: 'Ajustes afectos al IVAP', descripcion: 'Ajustes afectos al IVAP', grupo: 'Ajustes', comportamiento: 'monto_directo' },
  { codigo: '13', etiqueta: 'Ajuste de montos por retiro de bienes', descripcion: 'Ajuste de montos y/o Fechas de retiro de bienes normados por Leyes o Reglamentos', grupo: 'Ajustes', comportamiento: 'monto_directo' },
]

// ── Catálogo 10 — Tipo de Nota de Débito ──────────────────────────────────────
export const CATALOGO_10_NOTA_DEBITO: CatalogoItem[] = [
  { codigo: '01', etiqueta: 'Intereses por mora', descripcion: 'Intereses por mora', grupo: 'Intereses', comportamiento: 'monto_directo', hint: 'Cargo por retraso en el pago del comprobante original.' },
  { codigo: '02', etiqueta: 'Aumento en el valor', descripcion: 'Aumento en el valor', grupo: 'Ajustes', comportamiento: 'monto_directo', hint: 'El valor pactado subió después de emitido el comprobante.' },
  { codigo: '03', etiqueta: 'Penalidades / otros conceptos', descripcion: 'Penalidades/ otros conceptos', grupo: 'Ajustes', comportamiento: 'monto_directo' },
]

// ── Catálogo 20 — Motivo de traslado (Guía de Remisión) ───────────────────────
export const CATALOGO_20_MOTIVO_TRASLADO: CatalogoItem[] = [
  { codigo: '01', etiqueta: 'Venta', descripcion: 'Venta', grupo: 'Comercial', comportamiento: 'items', hint: 'El traslado sustenta una venta ya facturada.' },
  { codigo: '02', etiqueta: 'Compra', descripcion: 'Compra', grupo: 'Comercial', comportamiento: 'items' },
  { codigo: '04', etiqueta: 'Traslado entre establecimientos de la misma empresa', descripcion: 'Traslado entre establecimientos de la misma empresa', grupo: 'Interno', comportamiento: 'items' },
  { codigo: '08', etiqueta: 'Importación', descripcion: 'Importación', grupo: 'Comercial', comportamiento: 'items' },
  { codigo: '09', etiqueta: 'Exportación', descripcion: 'Exportación', grupo: 'Comercial', comportamiento: 'items' },
  { codigo: '13', etiqueta: 'Otros', descripcion: 'Otros', grupo: 'Otros', comportamiento: 'items' },
  { codigo: '14', etiqueta: 'Venta sujeta a confirmación del comprador', descripcion: 'Venta sujeta a confirmación del comprador', grupo: 'Comercial', comportamiento: 'items' },
  { codigo: '18', etiqueta: 'Traslado emisor itinerante CP', descripcion: 'Traslado emisor itinerante CP', grupo: 'Otros', comportamiento: 'items' },
  { codigo: '19', etiqueta: 'Traslado a zona primaria', descripcion: 'Traslado a zona primaria', grupo: 'Otros', comportamiento: 'items' },
]

// ── Catálogo 18 — Modalidad de transporte ─────────────────────────────────────
export const CATALOGO_18_MODALIDAD_TRANSPORTE: CatalogoItem[] = [
  { codigo: '01', etiqueta: 'Transporte público', descripcion: 'Transporte público', grupo: 'Modalidad', comportamiento: 'documento_completo', hint: 'Un tercero (empresa de transporte con RUC) traslada los bienes.' },
  { codigo: '02', etiqueta: 'Transporte privado', descripcion: 'Transporte privado', grupo: 'Modalidad', comportamiento: 'documento_completo', hint: 'El propio negocio traslada los bienes con su vehículo y conductor.' },
]

export function buscarMotivo(catalogo: CatalogoItem[], codigo: string): CatalogoItem | undefined {
  return catalogo.find(m => m.codigo === codigo)
}
