import PlantillaFacturaClasica from './PlantillaFacturaClasica'
import PlantillaFacturaModerna from './PlantillaFacturaModerna'
import PlantillaFacturaCompacta from './PlantillaFacturaCompacta'

export function getPlantillaFactura(formato: string) {
  switch (formato) {
    case 'moderno': return PlantillaFacturaModerna
    case 'compacto': return PlantillaFacturaCompacta
    case 'clasico':
    default:
      return PlantillaFacturaClasica
  }
}
