/**
 * WhatsApp Channel Adapter
 *
 * Uses the existing YCloud integration (src/lib/whatsapp/ycloud.ts)
 * to send notifications via WhatsApp.
 */

import type { NotificationChannel, ChannelContext, SendParams, SendResult } from '../types'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'

export class WhatsAppChannel implements NotificationChannel {
  id = 'whatsapp'
  name = 'WhatsApp'

  async isAvailable(ctx: ChannelContext): Promise<boolean> {
    return !!(ctx.telefonoWhatsapp && ctx.apiKey)
  }

  async send(params: SendParams): Promise<SendResult> {
    try {
      const result = await enviarMensaje({
        from: params.from.replace(/^\+/, ''),
        to: params.to.replace(/^\+/, ''),
        texto: params.message,
        apiKey: params.metadata?.apiKey as string | undefined,
      })

      return {
        success: true,
        channelId: this.id,
        messageId: result.id,
      }
    } catch (e) {
      return {
        success: false,
        channelId: this.id,
        error: e instanceof Error ? e.message : 'Unknown WhatsApp error',
      }
    }
  }
}
