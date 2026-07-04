import PlantillaBoletaClasica from './PlantillaBoletaClasica'
import PlantillaBoletaModerna from './PlantillaBoletaModerna'
import PlantillaBoletaCompacta from './PlantillaBoletaCompacta'

export function getPlantillaBoleta(formato: string) {
  switch (formato) {
    case 'moderno': return PlantillaBoletaModerna
    case 'compacto': return PlantillaBoletaCompacta
    case 'clasico':
    default:
      return PlantillaBoletaClasica
  }
}
