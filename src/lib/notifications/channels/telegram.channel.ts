/**
 * Telegram Channel Adapter — STUB
 *
 * Ready for future implementation. Implements NotificationChannel
 * interface so it can be registered in the dispatcher when configured.
 *
 * To activate:
 *   1. Set TELEGRAM_BOT_TOKEN in environment
 *   2. Store chat_id per client in the database
 *   3. Register this channel in the dispatcher
 */

import type { NotificationChannel, ChannelContext, SendParams, SendResult } from '../types'

export class TelegramChannel implements NotificationChannel {
  id = 'telegram'
  name = 'Telegram'

  async isAvailable(_ctx: ChannelContext): Promise<boolean> {
    // Future: check if TELEGRAM_BOT_TOKEN is configured
    return false
  }

  async send(params: SendParams): Promise<SendResult> {
    // Future: implement Telegram Bot API call
    // POST https://api.telegram.org/bot{token}/sendMessage
    // { chat_id: params.to, text: params.message, parse_mode: 'Markdown' }
    console.warn('[Telegram] Channel not yet implemented. Message to:', params.to)
    return {
      success: false,
      channelId: this.id,
      error: 'Telegram channel not yet implemented',
    }
  }
}
