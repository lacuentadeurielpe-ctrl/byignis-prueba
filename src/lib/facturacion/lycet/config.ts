// Configuración del microservicio Lycet desde variables de entorno.
// Único punto de lectura de LYCET_BASE_URL / LYCET_API_TOKEN — evita duplicar
// el mensaje de error en cada módulo que necesita hablar con Lycet.

import type { LycetConfig } from './client'

export function getLycetConfig(): LycetConfig {
  const baseUrl = process.env.LYCET_BASE_URL
  const token   = process.env.LYCET_API_TOKEN
  if (!baseUrl || !token) {
    throw new Error(
      'El servicio de facturación no está disponible (LYCET_BASE_URL / LYCET_API_TOKEN no configurados). Contacta al administrador.',
    )
  }
  return { baseUrl, token }
}
