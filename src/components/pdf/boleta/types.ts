import { PropsPDF } from '../shared/types'

export interface PropsBoleta extends PropsPDF {
  // Boleta no requiere campos adicionales por ahora, 
  // pero lo extendemos para mantener la estructura por si a futuro SUNAT exige algo más
}
