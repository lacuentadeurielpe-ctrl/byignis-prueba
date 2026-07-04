import PlantillaBoletaA4 from './PlantillaBoletaA4'
import PlantillaBoletaTicket80 from './PlantillaBoletaTicket80'
import PlantillaBoletaTicket58 from './PlantillaBoletaTicket58'

export const getPlantillaBoleta = (formato?: string) => {
  switch (formato) {
    case 'ticket_80mm': return PlantillaBoletaTicket80
    case 'ticket_58mm': return PlantillaBoletaTicket58
    case 'a4': return PlantillaBoletaA4
    default: return PlantillaBoletaTicket80
  }
}
