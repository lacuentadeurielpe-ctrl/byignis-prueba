import { PropsPDF } from '../shared/types'

export interface PropsFactura extends PropsPDF {
  cliente_razon_social?: string
  cliente_ruc?: string
}
