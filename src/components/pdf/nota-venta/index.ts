import PlantillaNotaVentaTicket from './PlantillaNotaVentaTicket'
import PlantillaNotaVentaA5 from './PlantillaNotaVentaA5'
import PlantillaNotaVentaCompacta from './PlantillaNotaVentaCompacta'

export function getPlantillaNotaVenta(formato: string) {
  switch (formato) {
    case 'a5': return PlantillaNotaVentaA5
    case 'compacto': return PlantillaNotaVentaCompacta
    case 'ticket':
    default:
      return PlantillaNotaVentaTicket
  }
}
