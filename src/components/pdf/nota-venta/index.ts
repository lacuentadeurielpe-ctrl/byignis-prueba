import PlantillaNotaVentaA4 from './PlantillaNotaVentaA4'
import PlantillaNotaVentaTicket80 from './PlantillaNotaVentaTicket80'
import PlantillaNotaVentaTicket58 from './PlantillaNotaVentaTicket58'

export const getPlantillaNotaVenta = (formato?: string) => {
  switch (formato) {
    case 'ticket_80mm': return PlantillaNotaVentaTicket80
    case 'ticket_58mm': return PlantillaNotaVentaTicket58
    case 'a4': return PlantillaNotaVentaA4
    default: return PlantillaNotaVentaTicket80
  }
}
