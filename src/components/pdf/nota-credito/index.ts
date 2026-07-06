import PlantillaNotaA4 from './PlantillaNotaA4'

// Por ahora solo A4 — es el formato correcto y suficiente para NC/ND (mucho
// menos frecuentes que boleta/factura). Ticket 58/80mm queda como fast-follow
// si algún negocio lo pide; no es necesario para que el documento sea válido.
export const getPlantillaNota = (_formato?: string) => PlantillaNotaA4
