/**
 * WhatsApp Channel Adapter — proveedor-agnóstico.
 * Usa WASender si está presente en metadata (proveedor Meta o YCloud).
 * Fallback: envía directamente por YCloud usando la apiKey del env.
 */

import type { NotificationChannel, ChannelContext, SendParams, SendResult } from '../types'
import type { WASender } from '@/lib/whatsapp/types'
import { enviarMensaje } from '@/lib/whatsapp/ycloud'

export class WhatsAppChannel implements NotificationChannel {
  id = 'whatsapp'
  name = 'WhatsApp'

  async isAvailable(ctx: ChannelContext): Promise<boolean> {
    return !!(ctx.sender || (ctx.telefonoWhatsapp && ctx.apiKey))
  }

  async send(params: SendParams): Promise<SendResult> {
    try {
      const sender = params.metadata?.sender as WASender | undefined

      if (sender) {
        await sender.enviarMensaje({ to: params.to, texto: params.message })
        return { success: true, channelId: this.id }
      }

      // Fallback: YCloud directo (solo si hay apiKey)
      const result = await enviarMensaje({
        from: params.from.replace(/^\+/, ''),
        to: params.to.replace(/^\+/, ''),
        texto: params.message,
        apiKey: params.metadata?.apiKey as string | undefined,
      })

      return { success: true, channelId: this.id, messageId: result.id }
    } catch (e) {
      return {
        success: false,
        channelId: this.id,
        error: e instanceof Error ? e.message : 'Unknown WhatsApp error',
      }
    }
  }
}
