// Driver YCloud que implementa WASender.
// Delega en las funciones ya existentes en ../ycloud.ts.

import {
  enviarMensaje as ycEnviarMensaje,
  enviarImagen as ycEnviarImagen,
  enviarDocumento as ycEnviarDocumento,
  enviarEscribiendo as ycEnviarEscribiendo,
  marcarLeido as ycMarcarLeido,
} from '../ycloud'
import type { WASender } from '../types'

export function crearYCloudSender(params: {
  ferreteriaId: string
  telefonoFerreteria: string  // sin +
  apiKey: string
}): WASender {
  const { ferreteriaId, telefonoFerreteria, apiKey } = params

  return {
    provider: 'ycloud',
    ferreteriaId,
    telefonoFerreteria,

    async enviarMensaje({ to, texto }) {
      await ycEnviarMensaje({ from: telefonoFerreteria, to, texto, apiKey })
    },

    async enviarImagen({ to, imageUrl, caption }) {
      await ycEnviarImagen({ from: telefonoFerreteria, to, imageUrl, caption, apiKey })
    },

    async enviarDocumento({ to, pdfUrl, filename, caption }) {
      await ycEnviarDocumento({ from: telefonoFerreteria, to, pdfUrl, filename, caption, apiKey })
    },

    async marcarLeido(messageId) {
      await ycMarcarLeido(messageId, apiKey)
    },

    async enviarEscribiendo(to) {
      await ycEnviarEscribiendo({ from: telefonoFerreteria, to, apiKey })
    },
  }
}
