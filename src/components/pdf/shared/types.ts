export interface DatosEmisor {
  razon_social: string
  nombre_comercial: string
  ruc: string
  direccion: string
  logo_url?: string | null
}

export interface DatosComprobantePDF {
  numero_completo: string
  fecha: string
  cliente_nombre: string
  cliente_doc: string
  subtotal: number
  igv: number
  total: number
  hash: string
  qr_data_uri: string
}

export interface ItemPDF {
  cantidad: number
  descripcion: string
  precio_unitario: number
  subtotal: number
}

export interface TemaColor {
  primario: string
  secundario: string
}

export interface PropsPDF {
  emisor: DatosEmisor
  comprobante: DatosComprobantePDF
  items: ItemPDF[]
  tema: TemaColor
}
