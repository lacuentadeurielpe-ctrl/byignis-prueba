import { PropsPDF } from '../shared/types'

export interface PropsNota extends PropsPDF {
  tipoNota:          'credito' | 'debito'
  documentoAfectado: string   // ej: 'B001-00000012'
  motivoDescripcion: string
}
