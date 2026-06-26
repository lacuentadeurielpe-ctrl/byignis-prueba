// Driver Meta WhatsApp Cloud API que implementa WASender.
// Referencia: https://developers.facebook.com/docs/whatsapp/cloud-api/messages

import type { WASender } from '../types'

const GRAPH_VERSION = 'v18.0'

function e164(num: string): string {
  const limpio = num.replace(/[^\d]/g, '')
  return `+${limpio}`
}

async function metaFetch(
  phoneNumberId: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error(`[Meta] Error ${res.status}: ${err.slice(0, 300)}`)
    throw new Error(`Meta WhatsApp API error ${res.status}`)
  }
}

export function crearMetaSender(params: {
  ferreteriaId: string
  telefonoFerreteria: string  // sin +
  phoneNumberId: string       // ID interno de Meta para el número
  accessToken: string         // token de acceso (desencriptado)
}): WASender {
  const { ferreteriaId, telefonoFerreteria, phoneNumberId, accessToken } = params

  return {
    provider: 'meta',
    ferreteriaId,
    telefonoFerreteria,

    async enviarMensaje({ to, texto }) {
      await metaFetch(phoneNumberId, accessToken, {
        to: e164(to),
        type: 'text',
        text: { preview_url: false, body: texto },
      })
    },

    async enviarImagen({ to, imageUrl, caption }) {
      await metaFetch(phoneNumberId, accessToken, {
        to: e164(to),
        type: 'image',
        image: { link: imageUrl, ...(caption ? { caption } : {}) },
      })
    },

    async enviarDocumento({ to, pdfUrl, filename, caption }) {
      await metaFetch(phoneNumberId, accessToken, {
        to: e164(to),
        type: 'document',
        document: { link: pdfUrl, filename, ...(caption ? { caption } : {}) },
      })
    },

    async marcarLeido(messageId) {
      // Meta marca como leído vía el mismo endpoint de mensajes
      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }).catch(() => {/* silencioso */})
    },

    // Meta Cloud API no expone un endpoint de "typing" equivalente a YCloud
    async enviarEscribiendo(_to) { /* no-op */ },
  }
}
