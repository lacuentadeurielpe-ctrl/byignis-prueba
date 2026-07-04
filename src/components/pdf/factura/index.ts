import PlantillaFacturaA4 from './PlantillaFacturaA4'
import PlantillaFacturaTicket80 from './PlantillaFacturaTicket80'
import PlantillaFacturaTicket58 from './PlantillaFacturaTicket58'

export const getPlantillaFactura = (formato?: string) => {
  switch (formato) {
    case 'ticket_80mm': return PlantillaFacturaTicket80
    case 'ticket_58mm': return PlantillaFacturaTicket58
    case 'a4': return PlantillaFacturaA4
    default: return PlantillaFacturaA4
  }
}
