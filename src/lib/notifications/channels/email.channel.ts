/**
 * Email Channel Adapter — STUB
 *
 * Ready for future implementation. Implements NotificationChannel
 * interface so it can be registered when an email provider is configured.
 *
 * To activate:
 *   1. Configure email provider (Resend, SendGrid, SES, etc.)
 *   2. Store client email addresses in the database
 *   3. Register this channel in the dispatcher
 */

import type { NotificationChannel, ChannelContext, SendParams, SendResult } from '../types'

export class EmailChannel implements NotificationChannel {
  id = 'email'
  name = 'Email'

  async isAvailable(_ctx: ChannelContext): Promise<boolean> {
    // Future: check if email provider is configured
    return false
  }

  async send(params: SendParams): Promise<SendResult> {
    console.warn('[Email] Channel not yet implemented. Message to:', params.to)
    return {
      success: false,
      channelId: this.id,
      error: 'Email channel not yet implemented',
    }
  }
}
